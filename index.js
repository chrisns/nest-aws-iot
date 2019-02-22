const Cylon = require('cylon')
const camelCase = require('camelcase')
const AWSMqtt = require("aws-mqtt-client").default

const { AWS_IOT_ENDPOINT_HOST, ACCESS_TOKEN, DEVICE_ID } = process.env

const awsMqttClient = new AWSMqtt({
  endpointAddress: AWS_IOT_ENDPOINT_HOST
})

awsMqttClient.on("connect", () => awsMqttClient.subscribe([`$aws/things/nest_${DEVICE_ID}/shadow/update/documents`],
  { qos: 1 },
  (err, granted) => console.log("aws subscribed", granted)
))

awsMqttClient.on("error", (error) => console.log(error))

Cylon.robot({
  connections: {
    nest: { adaptor: 'nest', accessToken: ACCESS_TOKEN },
  },

  devices: {
    thermostat: { driver: 'nest-thermostat', connection: 'nest', deviceId: DEVICE_ID },
  },

  work: function (my) {
    my.thermostat.on('status', data =>
      awsMqttClient.publish(`$aws/things/nest_${DEVICE_ID}/shadow/update`, JSON.stringify({ state: { reported: data } }), { qos: 0 })
    )

    awsMqttClient.on("message", (topic, message) => {
      const parsed_message = JSON.parse(message.toString()).current.state
      if (!parsed_message.desired) return
      console.log(parsed_message)
      Object.entries(parsed_message.desired).forEach(([key, value]) => {
        try {
          my.thermostat[camelCase(key)](value)
          console.info(`${key} setting to ${value}`)
        }
        catch (error) {
          console.error(`${key} set to ${value} failed`)
        }
      })
      return awsMqttClient.publish(`$aws/things/nest_${DEVICE_ID}/shadow/update`, JSON.stringify({ state: { desired: null } }), { qos: 0 })
    })
  }
}).start()