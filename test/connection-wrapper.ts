import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const amqplib = require('amqplib') as typeof import('amqplib');

import { ChannelMock, ConfirmChannelMock, connMockHandler, connectMock, mockConf, ConnectionMock } from './amqplib-mock';
import { promisifyEvent } from './promisify-event';

import { ConnectionWrapper } from '../src/connection-wrapper';

chaiUse(chaiAsPromised);

const TEST_RECONNECT_TIMEOUT = 50;
const TEST_CLOSE_TIMEOUT = 50;

describe('ConnectionWrapper', () => {
    let connectOrig: typeof amqplib.connect;
    before(() => {
        connectOrig = amqplib.connect;
        amqplib.connect = connectMock as unknown as typeof amqplib.connect;
    });

    after(() => {
        amqplib.connect = connectOrig;
    });

    beforeEach(() => {
        mockConf.connectThrows = 0;
        mockConf.createThrows = false;
        connMockHandler.connMock = undefined;
    });

    it('should create Connection', async () => {
        const connWrap = new ConnectionWrapper('amqp://localhost/?reconnectTimeout=10');
        await promisifyEvent(connWrap, 'connect');
        expect(connMockHandler.connMock).instanceOf(ConnectionMock);
    }).timeout(TEST_RECONNECT_TIMEOUT);

    describe('reconnect', () => {
        it('should reconnect after <reconnectTimeout> ms if connect() throws', async () => {
            mockConf.connectThrows = 1;
            const connWrap = new ConnectionWrapper({
                reconnectTimeout: TEST_RECONNECT_TIMEOUT,
            });
            connWrap.on('error', () => {}); // eslint-disable-line @typescript-eslint/no-empty-function
            const start = Date.now();
            await promisifyEvent(connWrap, 'connect');
            expect(connMockHandler.connMock).instanceOf(ConnectionMock);
            expect(Date.now() - start + 1).greaterThanOrEqual(TEST_RECONNECT_TIMEOUT);
        }).timeout(TEST_RECONNECT_TIMEOUT * 2).slow(TEST_RECONNECT_TIMEOUT * 6);

        it('should reconnect after <reconnectTimeout> ms if it is closed', async () => {
            const connWrap = new ConnectionWrapper({
                reconnectTimeout: TEST_RECONNECT_TIMEOUT,
            });
            await promisifyEvent(connWrap, 'connect');
            if (!connMockHandler.connMock) {
                expect.fail();
            }
            const conn = connMockHandler.connMock;
            void conn.close();
            const start = Date.now();
            await promisifyEvent(connWrap, 'connect');
            expect(connMockHandler.connMock).instanceOf(ConnectionMock);
            expect(connMockHandler.connMock).not.equal(conn);
            expect(Date.now() - start + 1).greaterThanOrEqual(TEST_RECONNECT_TIMEOUT);
        }).timeout(TEST_RECONNECT_TIMEOUT * 2).slow(TEST_RECONNECT_TIMEOUT * 6);

        it('should emit "close" if connect() throws and reconnectTimeout not set', async () => {
            mockConf.connectThrows = 1;
            let connWrap = new ConnectionWrapper({});
            connWrap.on('error', () => {}); // eslint-disable-line @typescript-eslint/no-empty-function
            await promisifyEvent(connWrap, 'close');

            mockConf.connectThrows = 1;
            connWrap = new ConnectionWrapper('amqp://localhost/');
            connWrap.on('error', () => {}); // eslint-disable-line @typescript-eslint/no-empty-function
            await promisifyEvent(connWrap, 'close');
        }).timeout(TEST_CLOSE_TIMEOUT);

        it('should stop reconnecting if close() called', async () => {
            mockConf.connectThrows = 1;
            const connWrap = new ConnectionWrapper({
                reconnectTimeout: TEST_RECONNECT_TIMEOUT,
            });
            connWrap.on('error', () => {}); // eslint-disable-line @typescript-eslint/no-empty-function
            await connWrap.close();
            await promisifyEvent(connWrap, 'close');
        }).timeout(TEST_CLOSE_TIMEOUT);
    });

    describe('close()', () => {
        it('should close Connection after connected', async () => {
            const connWrap = new ConnectionWrapper({});
            await promisifyEvent(connWrap, 'connect');
            if (!connMockHandler.connMock) {
                expect.fail();
            }
            const conn = connMockHandler.connMock;
            await connWrap.close();
            expect(conn.closed).equal(true);
        });

        it('should close Connection if called before connect()', async () => {
            const connWrap = new ConnectionWrapper({});
            await connWrap.close();
            if (connMockHandler.connMock) {
                await promisifyEvent(connMockHandler.connMock, 'close');
            }
        }).timeout(TEST_CLOSE_TIMEOUT);
    });

    describe('createChannelWrapper()', () => {
        it('should create ChannelWrapper', async () => {
            const connWrap = new ConnectionWrapper({});
            const chanWrap = connWrap.createChannelWrapper();
            await expect(chanWrap.getChannel()).eventually.instanceOf(ChannelMock);
        });

        it('should create invalid ChannelWrapper if closed', async () => {
            const connWrap = new ConnectionWrapper({});
            await connWrap.close();
            const chanWrap = connWrap.createChannelWrapper();
            await expect(chanWrap.getChannel()).eventually.equal(null);
        });
    });

    describe('createConfirmChannelWrapper()', () => {
        it('should create ConfirmChannelWrapper', async () => {
            const connWrap = new ConnectionWrapper({});
            const chanWrap = connWrap.createConfirmChannelWrapper();
            await expect(chanWrap.getChannel()).eventually.instanceOf(ConfirmChannelMock);
        });

        it('should create invalid ConfirmChannelWrapper if closed', async () => {
            const connWrap = new ConnectionWrapper({});
            await connWrap.close();
            const chanWrap = connWrap.createConfirmChannelWrapper();
            await expect(chanWrap.getChannel()).eventually.equal(null);
        });
    });

    describe('block', () => {
        it('should catch "blocked/unblocked" events', async () => {
            const connWrap = new ConnectionWrapper({});
            await promisifyEvent(connWrap, 'connect');
            if (!connMockHandler.connMock) {
                expect.fail();
            }
            expect(connWrap.isBlocked()).equal(false);
            connMockHandler.connMock.emit('blocked');
            expect(connWrap.isBlocked()).equal(true);
            connMockHandler.connMock.emit('unblocked');
            expect(connWrap.isBlocked()).equal(false);
        });
    });

    it('should handle "error" event', async () => {
        const connWrap = new ConnectionWrapper({});
        const perr = promisifyEvent(connWrap, 'error');
        await promisifyEvent(connWrap, 'connect');
        if (connMockHandler.connMock) {
            connMockHandler.connMock.emit('error', new Error());
        }
        await expect(perr).eventually.instanceOf(Error);
    });
});
