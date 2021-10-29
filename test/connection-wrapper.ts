import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const amqplib = require('amqplib') as typeof import('amqplib');

import { ChannelMock, ConfirmChannelMock, ConnectionMock, ConnectMock } from './amqplib-mock';
import { promisifyEvent } from './promisify-event';

import { ConnectionWrapper } from '../src/connection-wrapper';

chaiUse(chaiAsPromised);

const TEST_RECONNECT_TIMEOUT = 50;
const TEST_CLOSE_TIMEOUT = 50;

describe('ConnectionWrapper', () => {
    let connectOrig: typeof amqplib.connect;
    let connectMock: ConnectMock;

    before(() => {
        connectOrig = amqplib.connect;
    });

    after(() => {
        amqplib.connect = connectOrig;
    });

    beforeEach(() => {
        connectMock = new ConnectMock();
        amqplib.connect = connectMock.connect.bind(connectMock) as unknown as typeof amqplib.connect;
    });

    describe('#createChannelWrapper()', () => {
        it('should create ChannelWrapper', async () => {
            const connWrap = new ConnectionWrapper({});
            const chanWrap = connWrap.createChannelWrapper();
            await expect(chanWrap.getChannel()).eventually.instanceOf(ChannelMock);
        });
    });

    describe('#createConfirmChannelWrapper()', () => {
        it('should create ConfirmChannelWrapper', async () => {
            const connWrap = new ConnectionWrapper({});
            const chanWrap = connWrap.createConfirmChannelWrapper();
            await expect(chanWrap.getChannel()).eventually.instanceOf(ConfirmChannelMock);
        });
    });

    describe('#isBlocked()', () => {
        it('should return true if connection blocked', async () => {
            const connWrap = new ConnectionWrapper({});
            await promisifyEvent(connWrap, 'connect');
            connectMock.connections[0].emit('blocked');
            expect(connWrap.isBlocked()).equal(true);
        });

        it('should return true if connection unblocked', async () => {
            const connWrap = new ConnectionWrapper({});
            await promisifyEvent(connWrap, 'connect');
            connectMock.connections[0].emit('blocked');
            connectMock.connections[0].emit('unblocked');
            expect(connWrap.isBlocked()).equal(false);
        });
    });

    describe('#close()', () => {
        it('should close Connection after connected', async () => {
            const connWrap = new ConnectionWrapper({});
            await promisifyEvent(connWrap, 'connect');
            const conn = connectMock.connections[0];
            await connWrap.close();
            expect(conn.closed).equal(true);
        });

        it('should close Connection if called before connect()', async () => {
            const connWrap = new ConnectionWrapper({});
            await connWrap.close();
            await promisifyEvent(connectMock.connections[0], 'close');
        }).timeout(TEST_CLOSE_TIMEOUT);

        it('should stop reconnection', async () => {
            connectMock.connectThrows = 1;
            const connWrap = new ConnectionWrapper({
                reconnectTimeout: TEST_RECONNECT_TIMEOUT,
            });
            connWrap.on('error', () => {}); // eslint-disable-line @typescript-eslint/no-empty-function
            const p = promisifyEvent(connWrap, 'close');
            await connWrap.close();
            await p;
        }).timeout(TEST_CLOSE_TIMEOUT);
    });

    describe('event "connect"', () => {
        it('should be emitted after ConnectionWrapper constructed', async () => {
            const connWrap = new ConnectionWrapper('amqp://localhost/?reconnectTimeout=10');
            await promisifyEvent(connWrap, 'connect');
            expect(connectMock.connections[0]).instanceOf(ConnectionMock);
        }).timeout(TEST_RECONNECT_TIMEOUT);

        it('should be emitted after <reconnectTimeout> ms if connect() throws', async () => {
            connectMock.connectThrows = 1;
            const connWrap = new ConnectionWrapper({
                reconnectTimeout: TEST_RECONNECT_TIMEOUT,
            });
            connWrap.on('error', () => {}); // eslint-disable-line @typescript-eslint/no-empty-function
            const start = Date.now();
            await promisifyEvent(connWrap, 'connect');
            expect(connectMock.connections[0]).instanceOf(ConnectionMock);
            expect(Date.now() - start + 1).greaterThanOrEqual(TEST_RECONNECT_TIMEOUT);
        }).timeout(TEST_RECONNECT_TIMEOUT * 2)
            .slow(TEST_RECONNECT_TIMEOUT * 3);

        it('should be emitted after <reconnectTimeout> ms if connection closed', async () => {
            const connWrap = new ConnectionWrapper({
                reconnectTimeout: TEST_RECONNECT_TIMEOUT,
            });
            connWrap.on('error', () => {}); // eslint-disable-line @typescript-eslint/no-empty-function
            await promisifyEvent(connWrap, 'connect');
            connectMock.connections[0].testClose(new Error());
            const start = Date.now();
            await promisifyEvent(connWrap, 'connect');
            expect(connectMock.connections[1]).instanceOf(ConnectionMock);
            expect(Date.now() - start + 1).greaterThanOrEqual(TEST_RECONNECT_TIMEOUT);
        }).timeout(TEST_RECONNECT_TIMEOUT * 2)
            .slow(TEST_RECONNECT_TIMEOUT * 3);
    });

    describe('event "close"', () => {
        it('should be emitted if connect() throws and reconnectTimeout not set in qs', async () => {
            connectMock.connectThrows = 1;
            const connWrap = new ConnectionWrapper({});
            connWrap.on('error', () => {}); // eslint-disable-line @typescript-eslint/no-empty-function
            await promisifyEvent(connWrap, 'close');
        }).timeout(TEST_CLOSE_TIMEOUT);

        it('should be emitted if connect() throws and reconnectTimeout not set in config', async () => {
            connectMock.connectThrows = 1;
            const connWrap = new ConnectionWrapper('amqp://localhost/');
            connWrap.on('error', () => {}); // eslint-disable-line @typescript-eslint/no-empty-function
            await promisifyEvent(connWrap, 'close');
        }).timeout(TEST_CLOSE_TIMEOUT);
    });
});
