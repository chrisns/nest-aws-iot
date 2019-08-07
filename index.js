global.log = console
const rp = require('request-promise');
const AWSMqtt = require("aws-mqtt-client").default
const NestMutex = require('./node_modules/homebridge-nest/lib/nest-mutex.js');

const { AWS_IOT_ENDPOINT_HOST, ACCESS_TOKEN, USER_ID } = process.env

const awsMqttClient = new AWSMqtt({
  endpointAddress: AWS_IOT_ENDPOINT_HOST
})

const NestConnection = require('./node_modules/homebridge-nest/lib/nest-connection.js');

const const_aws_publish = (device, payload) =>
  awsMqttClient.publish(`$aws/things/nest_${device}/shadow/update`, JSON.stringify({ state: { reported: payload } }), { qos: 0 })

const update_aws = data =>
  Object.keys(data.devices)
    .map(device_type => data.devices[device_type])
    .filter(device_type => Object.keys(device_type).length)
    .map(device_type => Object.keys(device_type)
      .map(device => const_aws_publish(device, device_type[device]))
    )

const conn = new NestConnection(ACCESS_TOKEN, console.log, true)
conn.mutex = new NestMutex(console.log)
conn.userid = USER_ID

conn.log = console.log
conn.debug = console.debug
conn.verbose = console.log
conn.error = console.error

conn.currentState = {}
conn.objectList = { objects: [] }
conn.get_transport_url = () => rp({
  uri: 'https://home.nest.com/session',
  headers: {
    'Authorization': 'Basic ' + ACCESS_TOKEN,
  },
  json: true
}).then(session => conn.transport_url = session.urls.transport_url)


awsMqttClient.on("connect", () =>
  conn.get_transport_url()
    .then(() => conn.updateData())
    .then(data => Object.keys(data.devices.thermostats).map(id => `$aws/things/nest_${id}/shadow/update/documents`))
    .then(topics => awsMqttClient.subscribe(topics,
      { qos: 1 },
      (err, granted) => console.log("aws subscribed", granted, err)
    ))
    .then(() => conn.subscribe(update_aws))
)

awsMqttClient.on("error", (error) => console.log(error))

awsMqttClient.on("message", (topic, message) => {
  const parsed_message = JSON.parse(message.toString()).current.state
  if (!parsed_message.desired) return
  const device_id = topic
    .replace("$aws/things/nest_", "")
    .replace("/shadow/update/documents", "")
  Object.entries(parsed_message.desired).forEach(([key, value]) =>
    conn.update(`shared.${device_id}`, key, value)
  )
  console.log(device_id, parsed_message.desired)
  return awsMqttClient.publish(topic.replace("/documents", ""), JSON.stringify({ state: { desired: null } }), { qos: 0 })
})