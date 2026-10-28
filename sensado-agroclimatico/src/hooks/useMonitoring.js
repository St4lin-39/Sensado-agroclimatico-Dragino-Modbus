import { useCallback, useEffect, useRef, useState } from 'react'
import { monitoringService } from '../services/monitoringService.js'

export function useMonitoring() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now)
  const requestId = useRef(0)
  const load = useCallback(() => {
    const id = ++requestId.current
    return monitoringService.getOverview().then((result) => {
      if (id !== requestId.current) return
      setData(result)
      setNow(Date.now())
      setError('')
    }).catch(() => {
      if (id === requestId.current) setError('No se pudieron consultar las lecturas. Intenta actualizar nuevamente.')
    }).finally(() => {
      if (id === requestId.current) setLoading(false)
    })
  }, [])
  const refresh = useCallback(() => {
    setLoading(true)
    setError('')
    return load()
  }, [load])
  const cancel = useCallback(() => { requestId.current++ }, [])
  useEffect(() => {
    load()
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => { clearInterval(timer); cancel() }
  }, [load, cancel])
  return { data, loading, error, now, refresh }
}
