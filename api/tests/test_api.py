import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient
from api.main import app, get_influx, Influx, Settings, UpstreamError


class FakeInflux(Influx):
    def __init__(self):
        super().__init__(Settings('http://localhost:8086', 'agricultura', 'sensores_agricolas', 'test-only'))
        self.rows = []
        self.queries = []
        self.unavailable = False

    def query(self, query):
        self.queries.append(query)
        if self.unavailable:
            raise UpstreamError('private upstream content')
        return self.rows


class Endpoints(unittest.TestCase):
    def setUp(self):
        self.influx = FakeInflux()
        app.dependency_overrides[get_influx] = lambda: self.influx
        self.client = TestClient(app)
        self.time = datetime.now(timezone.utc) - timedelta(minutes=5)

    def tearDown(self):
        app.dependency_overrides.clear()

    def row(self, name='nitrogen', value='0', time=None):
        return {'_field': name, '_value': value, '_time': (time or self.time).isoformat()}

    def test_inventory_and_unknown_device(self):
        self.assertEqual(len(self.client.get('/api/devices').json()['devices']), 4)
        for endpoint in ('latest', 'history?metric=nitrogen'):
            self.assertEqual(self.client.get('/api/devices/unknown/' + endpoint).status_code, 404)
        self.assertFalse(self.influx.queries)

    def test_no_data_and_read_only(self):
        data = self.client.get('/api/devices/rs485-lb-01/latest').json()
        self.assertIsNone(data['timestamp'])
        self.assertTrue(all(r['value'] is None for r in data['measurements'].values()))
        self.assertEqual(self.client.get('/api/devices/rs485-lb-01/history?metric=nitrogen').json()['points'], [])
        self.assertEqual(self.client.post('/api/devices').status_code, 405)

    def test_latest_does_not_mix_timestamps_and_preserves_zero(self):
        self.influx.rows = [self.row(), self.row('potassium', '15', self.time - timedelta(minutes=1))]
        data = self.client.get('/api/devices/rs485-lb-01/latest').json()
        self.assertEqual(data['measurements']['nitrogen']['value'], 0)
        self.assertIsNone(data['measurements']['potassium']['value'])
        self.assertIsNone(data['measurements']['phosphorus']['value'])
        self.assertIn('last()', self.influx.queries[-1])

    def test_invalid_upstream_data(self):
        self.influx.rows = [self.row(value='NaN'), self.row(value='inf'), self.row(value='-999'),
                            {**self.row(), '_time': 'invalid'},
                            {**self.row(), '_time': '2026-01-01T00:00:00'},
                            self.row('co2'), self.row(time=datetime.now(timezone.utc) + timedelta(days=1))]
        self.assertIsNone(self.client.get('/api/devices/rs485-lb-01/latest').json()['timestamp'])
        self.assertEqual(self.client.get('/api/devices/rs485-lb-01/history?metric=nitrogen').json()['points'], [])

    def test_history_sorted_unique_bounded(self):
        self.influx.rows = [self.row(time=self.time + timedelta(minutes=1)), self.row(), self.row()]
        data = self.client.get('/api/devices/rs485-lb-01/history?metric=nitrogen&hours=6&limit=2').json()
        self.assertEqual(len(data['points']), 2)
        self.assertLess(data['points'][0]['timestamp'], data['points'][1]['timestamp'])
        self.assertIn('window(every: 10800s)', self.influx.queries[-1])
        self.assertIn('limit(n: 2)', self.influx.queries[-1])

    def test_invalid_queries_never_reach_database(self):
        for query in ('metric=co2', 'metric=temperature', 'metric=nitrogen&hours=169',
                      'metric=nitrogen&hours=bad', 'metric=nitrogen&limit=1001',
                      'metric=nitrogen&limit=0', 'metric=nitrogen&start=invalid',
                      'metric=nitrogen&bucket=other', 'metric=nitrogen&flux=anything',
                      'metric=nitrogen&metric=potassium', ''):
            self.assertEqual(self.client.get('/api/devices/rs485-lb-01/history?' + query).status_code, 422)
        self.assertFalse(self.influx.queries)

    def test_environment_tag_is_translated(self):
        self.influx.rows = [self.row('temperature', '24.5')]
        data = self.client.get('/api/devices/rak7431-byx-01/latest').json()
        self.assertEqual(data['sensor_type'], 'byx')
        self.assertEqual(data['measurements']['temperature']['value'], 24.5)
        self.assertIn('r.sensor_type == "environment"', self.influx.queries[-1])
        self.assertNotIn('co2', self.influx.queries[-1])

    def test_unavailable_is_sanitized(self):
        self.influx.unavailable = True
        response = self.client.get('/api/devices/rs485-lb-01/latest')
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private', response.text)

    def test_health_and_missing_configuration(self):
        app.dependency_overrides.clear()
        with patch('api.main.get_influx', return_value=self.influx):
            self.assertEqual(self.client.get('/api/health').json(), {'api': 'ok', 'influxdb': 'accessible'})
            self.influx.unavailable = True
            response = self.client.get('/api/health')
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.json()['api'], 'ok')
        with patch.dict('os.environ', {}, clear=True):
            self.assertEqual(self.client.get('/api/health').status_code, 503)
            self.assertEqual(self.client.get('/api/devices/unknown/latest').status_code, 404)
            self.assertEqual(self.client.get('/api/devices/rs485-lb-01/latest').status_code, 503)
            self.assertEqual(self.client.get('/api/devices').status_code, 200)

    def test_http_csv_transport(self):
        csv = b'#datatype,string,long,dateTime:RFC3339,double,string\n,result,table,_time,_value,_field\n,,0,2026-10-28T10:00:00Z,0,nitrogen\n'
        with patch('api.main.build_opener') as opener:
            opener.return_value.open.return_value.__enter__.return_value.read.return_value = csv
            rows = self.influx.__class__.__mro__[1].query(self.influx, 'fixed query')
            self.assertEqual(rows[0]['_value'], '0')
            request = opener.return_value.open.call_args.args[0]
            self.assertEqual(request.method, 'POST')
            self.assertIn('/api/v2/query?org=agricultura', request.full_url)
            self.assertNotIn('test-only', request.full_url)
            opener.return_value.open.return_value.__enter__.return_value.read.return_value = b'bad csv'
            with self.assertRaises(UpstreamError):
                Influx.query(self.influx, 'fixed query')


if __name__ == '__main__':
    unittest.main()
