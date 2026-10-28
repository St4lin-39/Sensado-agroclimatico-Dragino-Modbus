FROM nodered/node-red:4.1.10

USER root

RUN npm install --unsafe-perm --no-update-notifier --no-fund --only=production node-red-contrib-influxdb@0.7.0

USER node-red

COPY flows.json /data/flows.json
