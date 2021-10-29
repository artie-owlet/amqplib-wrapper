import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const amqplib = require('amqplib') as typeof import('amqplib');

import { ChannelMock, ConnectMock } from './amqplib-mock';
import { promisifyEvent } from './promisify-event';

import { ConnectionWrapper } from '../src/connection-wrapper';

chaiUse(chaiAsPromised);

const TEST_RECONNECT_TIMEOUT = 50;

function test(method: 'createChannelWrapper' | 'createConfirmChannelWrapper', chanType: string): void {
    describe(`ChannelWrapper<${chanType}>`, () => {
        let connectOrig: typeof amqplib.connect;
        let connectMock: ConnectMock;
        let connWrap: ConnectionWrapper;

        before(() => {
            connectOrig = amqplib.connect;
        });

        after(() => {
            amqplib.connect = connectOrig;
        });

        beforeEach(() => {
            connectMock = new ConnectMock();
            amqplib.connect = connectMock.connect.bind(connectMock) as unknown as typeof amqplib.connect;
            connWrap = new ConnectionWrapper({});
        });

        describe('#getChannel()', () => {
            it('should return channel', async () => {
                const chanWrap = connWrap[method]();
                await expect(chanWrap.getChannel()).eventually.instanceOf(ChannelMock);
            });

            it('should return new channel if current channel was closed without error', async () => {
                const chanWrap = connWrap[method]();
                const chan = await chanWrap.getChannel();
                connectMock.connections[0].channels[0].testClose();
                await expect(chanWrap.getChannel()).eventually.instanceOf(ChannelMock).not.equal(chan);
            });

            it('should return new channel if connection was closed and reconnected', async () => {
                const connWrap = new ConnectionWrapper({
                    reconnectTimeout: TEST_RECONNECT_TIMEOUT,
                });
                const chanWrap = connWrap[method]();
                const chan = await chanWrap.getChannel();
                connectMock.connections[1].testClose();
                await expect(chanWrap.getChannel()).eventually.instanceOf(ChannelMock).not.equal(chan);
            }).timeout(TEST_RECONNECT_TIMEOUT * 2)
                .slow(TEST_RECONNECT_TIMEOUT * 3);

            it('should return null after close()', async () => {
                const chanWrap = connWrap[method]();
                await chanWrap.getChannel();
                await chanWrap.close();
                await expect(chanWrap.getChannel()).eventually.equal(null);
            });

            it('should return null if close() was called before channel was opened', async () => {
                const chanWrap = connWrap[method]();
                await chanWrap.close();
                await expect(chanWrap.getChannel()).eventually.equal(null);
            });

            it('should return null if current channel was closed with error', async () => {
                const chanWrap = connWrap[method]();
                chanWrap.on('error', () => {}); // eslint-disable-line @typescript-eslint/no-empty-function
                await chanWrap.getChannel();
                connectMock.connections[0].channels[0].testClose(new Error());
                await expect(chanWrap.getChannel()).eventually.equal(null);
            });

            it('should return null if connection was closed and not reconnected', async () => {
                connWrap.on('error', () => {}); // eslint-disable-line @typescript-eslint/no-empty-function
                const chanWrap = connWrap[method]();
                await chanWrap.getChannel();
                connectMock.connections[0].testClose(new Error());
                await expect(chanWrap.getChannel()).eventually.equal(null);
            });

            it('should return null if createChannel throws', async () => {
                connectMock.connections[0].createThrows = 1;
                const chanWrap = connWrap[method]();
                chanWrap.on('error', () => {}); // eslint-disable-line @typescript-eslint/no-empty-function
                await expect(chanWrap.getChannel()).eventually.equal(null);
            });
        });

        describe('#getChannelSync()', () => {
            it('should return channel if it is currently open', async () => {
                const chanWrap = connWrap[method]();
                await promisifyEvent(chanWrap, 'open');
                expect(chanWrap.getChannelSync()).instanceOf(ChannelMock);
            });

            it('should return null if channel was closed with error', async () => {
                const chanWrap = connWrap[method]();
                chanWrap.on('error', () => {}); // eslint-disable-line @typescript-eslint/no-empty-function
                await promisifyEvent(chanWrap, 'open');
                connectMock.connections[0].channels[0].testClose(new Error());
                expect(chanWrap.getChannelSync()).equal(null);
            });
        });

        describe('#close()', () => {
            it('should close Channel',  async () => {
                const chanWrap = connWrap[method]();
                const chan = await chanWrap.getChannel() as unknown as ChannelMock;
                await chanWrap.close();
                expect(chan.closed).equal(true);
            });
        });

        describe('#reset()', () => {
            it('should close channel and open a new one', async () => {
                const chanWrap = connWrap[method]();
                const chan = await chanWrap.getChannel();
                await chanWrap.reset();
                await expect(chanWrap.getChannel()).eventually.instanceOf(ChannelMock).not.equal(chan);
            });
        });

        describe('event "open"', () => {
            it('should be emitted after ChanelWrapper constructed', async () => {
                const chanWrap = connWrap[method]();
                const chan = await promisifyEvent(chanWrap, 'open');
                expect(chan).instanceOf(ChannelMock);
            });

            it('should be emitted if channel closed without error', async () => {
                const chanWrap = connWrap[method]();
                const chan = await chanWrap.getChannel();
                if (!chan) {
                    expect.fail();
                }
                chan.emit('close');
                await expect(promisifyEvent(chanWrap, 'open')).eventually.instanceOf(ChannelMock).not.equal(chan);
            });
        });
    });
}
test('createChannelWrapper', 'Channel');
test('createConfirmChannelWrapper', 'ConfirmChannel');
