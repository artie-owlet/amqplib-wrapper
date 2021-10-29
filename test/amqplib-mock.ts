import EventEmitter from 'events';

import { Connection, Channel, ConfirmChannel } from 'amqplib';

export class ConnectMock {
    public connectThrows = 0;
    public connections = [] as ConnectionMock[];

    public async connect(): Promise<Connection> {
        await Promise.resolve();
        if (this.connectThrows > 0) {
            --this.connectThrows;
            throw new Error('Cannot connect');
        }
        const conn = new ConnectionMock();
        this.connections.push(conn);
        return conn as unknown as Connection;
    }
}

export class ConnectionMock extends EventEmitter {
    public connection = {
        serverProperties: {},
    };
    public closed = false;
    public createThrows = 0;
    public channels = [] as ChannelMock[];

    public async createChannel(): Promise<Channel> {
        await Promise.resolve();
        if (this.closed) {
            throw new Error('Connection closed');
        }
        if (this.createThrows > 0) {
            --this.createThrows;
            throw new Error('Cannot open');
        }
        const chan = new ChannelMock();
        this.channels.push(chan);
        return chan as unknown as Channel;
    }

    public async createConfirmChannel(): Promise<ConfirmChannel> {
        await Promise.resolve();
        if (this.closed) {
            throw new Error('Connection closed');
        }
        if (this.createThrows > 0) {
            --this.createThrows;
            throw new Error('Cannot open');
        }
        const chan = new ConfirmChannelMock();
        this.channels.push(chan);
        return chan as unknown as ConfirmChannel;
    }

    public async close(): Promise<void> {
        await Promise.resolve();
        if (this.closed) {
            throw new Error('Connection closed');
        }
        this.closed = true;
        this.channels.filter(chan => !chan.closed).forEach(chan => chan.testClose());
        this.channels = [];
        this.emit('close');
    }

    public testClose(err?: Error): void {
        this.closed = true;
        if (err) {
            this.emit('error', err);
        }
        this.channels.filter(chan => !chan.closed).forEach(chan => chan.testClose());
        this.channels = [];
        this.emit('close');
    }
}

export class ChannelMock extends EventEmitter {
    public closed = false;

    public async close(): Promise<void> {
        if (this.closed) {
            throw new Error('Channel closed');
        }
        await Promise.resolve();
        this.closed = true;
        this.emit('close');
    }

    public testClose(err?: Error): void {
        this.closed = true;
        if (err) {
            this.emit('error', err);
        }
        this.emit('close');
    }
}

export class ConfirmChannelMock extends ChannelMock {}
