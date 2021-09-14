# amqplib-wrapper
![CI](https://github.com/artie-owlet/amqplib-wrapper/actions/workflows/ci.yaml/badge.svg)
![Coverage](https://github.com/artie-owlet/amqplib-wrapper/actions/workflows/coverage.yaml/badge.svg)
![Lint](https://github.com/artie-owlet/amqplib-wrapper/actions/workflows/lint.yaml/badge.svg)

Wrapper around [amqplib](https://www.npmjs.com/package/amqplib) that automatically reconnects and creates channels.

---

## Install

```bash
npm install @artie-owlet/amqplib-wrapper
```

## Usage

```javascript
import { ConnectionWrapper } from '@artie-owlet/amqplib-wrapper';

// create connection wrapper
const connWrap = new ConnectionWrapper({
    reconnectTimeout: 1000,
});

// create channel wrapper
const chanWrap = connWrap.createChannelWrapper();

// get amqplib Channel and immediately use it
const chan = await chanWrap.getChannel();
chan.publish('my-ex', 'rk', Buffer.from('hello'));

// handle "open" event to start/resume consuming
chanWrap.on('open', async (chan) => {
    await chan.assertQueue('my-queue');
    chan.consume('my-queue', (msg) => {
        // ...
    });
});
```

## API

### ConnectionWrapper

#### new ConnectionWrapper(config: string | IConnectOptions)

Start work. `config` extends config for [amqplib connect()](https://www.squaremobius.net/amqp.node/channel_api.html#connect) with additional parameters:

* `reconnectTimeout` (number, optional) - reconnection timeout in ms (if omitted wrapper will not reconnect).

```javascript
new ConnectionWrapper('amqp://guest:guest@localhost:5672/?reconnectTimeout=1000');

new ConnectionWrapper({
    protocol: 'amqp',
    hostname: 'localhost',
    port: 5672,
    username: 'guest',
    password: 'guest',
    vhost: '/',
    reconnectTimeout: 1000,
});
```

#### createChannelWrapper(): ChannelWrapper<amqplib.Channel>

Create amqplib Channel.

#### createConfirmChannelWrapper(): ChannelWrapper<amqplib.ConfirmChannel>

Create amqplib ConfirmChannel.

#### isBlocked(): boolean

Check is connection [blocked](https://www.rabbitmq.com/connection-blocked.html).

#### close(): Promise<void>

Stop wrapper and close connection.

### ChannelWrapper

#### getChannel(): Promise<Channel | null>

Get amqplib Channel (or ConfirmChannel). Returns `null` if channel was closed with error.

#### close(): Promise<void>

Stop wrapper and close channel.

#### reset(): Promise<void>

Close channel and open a new one.
