import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { Channel } from 'amqplib';

import { ChannelMock, createChannelMock, mockConf } from './amqplib-mock';
import { promisifyEvent } from './promisify-event';

import { ChannelWrapper } from '../src/channel-wrapper';

chaiUse(chaiAsPromised);

describe('ChannelWrapper', () => {
    beforeEach(() => {
        mockConf.connectThrows = 0;
        mockConf.createThrows = false;
    });

    describe('#getChannel()', () => {
        it('should return Channel', async () => {
            const chanWrap = new ChannelWrapper<Channel>(createChannelMock);
            await expect(chanWrap.getChannel()).eventually.instanceOf(ChannelMock);
        });

        it('should return null after close()', async () => {
            const chanWrap = new ChannelWrapper<Channel>(createChannelMock);
            await chanWrap.getChannel();
            await chanWrap.close();
            await expect(chanWrap.getChannel()).eventually.equal(null);
        });

        it('should return null if close() called before opened', async () => {
            const chanWrap = new ChannelWrapper<Channel>(createChannelMock);
            await chanWrap.close();
            await expect(chanWrap.getChannel()).eventually.equal(null);
        });

        it('should return null if closed with error', async () => {
            const chanWrap = new ChannelWrapper<Channel>(createChannelMock);
            chanWrap.on('error', () => {}); // eslint-disable-line @typescript-eslint/no-empty-function
            const chan = await chanWrap.getChannel();
            if (!chan) {
                expect.fail();
            }
            chan.emit('error', new Error());
            chan.emit('close');
            await expect(chanWrap.getChannel()).eventually.equal(null);
        });

        it('should return null if createChannel throws', async () => {
            mockConf.createThrows = true;
            const chanWrap = new ChannelWrapper<Channel>(createChannelMock);
            chanWrap.on('error', () => {}); // eslint-disable-line @typescript-eslint/no-empty-function
            await expect(chanWrap.getChannel()).eventually.equal(null);
        });
    });

    describe('#close()', () => {
        it('should close Channel',  async () => {
            const chanWrap = new ChannelWrapper<Channel>(createChannelMock);
            const chan = await chanWrap.getChannel() as unknown as ChannelMock;
            await chanWrap.close();
            expect(chan.closed).equal(true);
        });
    });

    describe('#reset()', () => {
        it('should close channel and open a new one', async () => {
            const chanWrap = new ChannelWrapper<Channel>(createChannelMock);
            const chan = await chanWrap.getChannel();
            await chanWrap.reset();
            await expect(chanWrap.getChannel()).eventually.instanceOf(ChannelMock).not.equal(chan);
        });
    });

    describe('#on("open")', () => {
        it('should be emitted after ChanelWrapper constructed', async () => {
            const chanWrap = new ChannelWrapper<Channel>(createChannelMock);
            const chan = await promisifyEvent(chanWrap, 'open');
            expect(chan).instanceOf(ChannelMock);
        });

        it('should be emitted if channel closed without error', async () => {
            const chanWrap = new ChannelWrapper<Channel>(createChannelMock);
            const chan = await chanWrap.getChannel();
            if (!chan) {
                expect.fail();
            }
            chan.emit('close');
            await expect(promisifyEvent(chanWrap, 'open')).eventually.instanceOf(ChannelMock).not.equal(chan);
        });
    });
});
