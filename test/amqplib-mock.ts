import EventEmitter from 'events';

import { Connection, Channel, ConfirmChannel } from 'amqplib';

export const mockConf = {
    connectThrows: 0,
    createThrows: false,
};

export class ChannelMock extends EventEmitter {
    public closed = false;

    public async close(): Promise<void> {
        await Promise.resolve();
        this.closed = true;
        this.emit('close');
    }
}

export class ConfirmChannelMock extends ChannelMock {}

export async function createChannelMock(ok = true): Promise<Channel | null> {
    await Promise.resolve();
    if (mockConf.createThrows) {
        throw new Error();
    }
    return ok ? new ChannelMock() as unknown as Channel : null;
}

export class ConnectionMock extends EventEmitter {
    public closed = false;
    public connection = {
        serverProperties: {},
    };

    public async createChannel(): Promise<Channel> {
        await Promise.resolve();
        if (mockConf.createThrows) {
            throw new Error();
        }
        return new ChannelMock() as unknown as Channel;
    }

    public async createConfirmChannel(): Promise<ConfirmChannel> {
        await Promise.resolve();
        if (mockConf.createThrows) {
            throw new Error();
        }
        return new ConfirmChannelMock() as unknown as ConfirmChannel;
    }

    public async close(): Promise<void> {
        await Promise.resolve();
        this.closed = true;
        this.emit('close');
    }
}

export const connMockHandler: {connMock?: ConnectionMock} = {};

export async function connectMock(): Promise<Connection> {
    await Promise.resolve();
    if (mockConf.connectThrows > 0) {
        --mockConf.connectThrows;
        throw new Error();
    }
    connMockHandler.connMock = new ConnectionMock();
    return connMockHandler.connMock as unknown as Connection;
}
