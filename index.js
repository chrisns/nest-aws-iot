global.log = console
global.Promise = require("bluebird")
const AWS = require("aws-sdk")
const AWSMqttClient = require('aws-mqtt/lib/NodeClient')

const { AWS_IOT_ENDPOINT_HOST, ACCESS_TOKEN, USER_ID } = process.env

const awsMqttClient = new AWSMqttClient({
  endpoint: AWS_IOT_ENDPOINT_HOST,
  credentials: AWS.config.credentials
})

const NestConnection = require('./node_modules/homebridge-nest/lib/nest-connection.js')

const const_aws_publish = (device, payload) =>
  awsMqttClient.publish(`$aws/things/nest_${device}/shadow/update`, JSON.stringify({ state: { reported: payload } }), { qos: 0 })

const update_aws = data =>
  Object.keys(data.devices)
    .map(device_type => data.devices[device_type])
    .filter(device_type => Object.keys(device_type).length)
    .map(device_type => Object.keys(device_type)
      .map(device => const_aws_publish(device, device_type[device]))
    )
const config = {
  access_token: ACCESS_TOKEN,
  userid: USER_ID
}
const conn = new NestConnection(config, console.log, true)

conn.log = console.log
conn.debug = console.debug
conn.verbose = console.log
conn.error = console.error

conn.currentState = {}
conn.objectList = { objects: [] }

awsMqttClient.on("connect", () =>
  conn.auth()
    .then(() => conn.updateData())
    .then(data => Object.keys(data.devices.thermostats).map(id => `$aws/things/nest_${id}/shadow/update/documents`))
    .then(topics => awsMqttClient.subscribe(topics,
      { qos: 1 },
      (err, granted) => console.log("aws subscribed", granted, err)
    ))
    .then(() => conn.subscribe(update_aws))
)

awsMqttClient.on("error", error => {
  console.log(error)
  process.exit(1)
})

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

awsMqttClient.on('connect', error => console.error("ERROR:", error));
awsMqttClient.on('error', error => console.error("ERROR:", error));
awsMqttClient.on('close', error => console.error("CLOSE:", error));
awsMqttClient.on('reconnect', error => console.error("RECONNECT:", error));
awsMqttClient.on('offline', error => console.error("OFFLINE:", error));