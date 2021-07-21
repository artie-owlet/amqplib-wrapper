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

    it('should create Channel and emit "open"', async () => {
        const chanWrap = new ChannelWrapper<Channel>(createChannelMock);
        const [echan, gchan] = await Promise.all<Channel, Channel | null>([
            promisifyEvent<Channel>(chanWrap, 'open'),
            chanWrap.getChannel(),
        ]);
        expect(echan).instanceOf(ChannelMock);
        expect(echan).equal(gchan);
    });

    it('should close Channel',  async () => {
        const chanWrap = new ChannelWrapper<Channel>(createChannelMock);
        const chan = await chanWrap.getChannel() as unknown as ChannelMock;
        await chanWrap.close();
        expect(chan.closed).equal(true);
    });

    it('should create Channel and emit "open" after it is closed without error', async () => {
        const chanWrap = new ChannelWrapper<Channel>(createChannelMock);
        const chan = await chanWrap.getChannel();
        if (!chan) {
            expect.fail();
        }
        chan.emit('close');
        const chan2 = await chanWrap.getChannel();
        expect(chan2).instanceOf(ChannelMock);
        expect(chan2).not.equal(chan);
    });

    it('should not create Channel after it is closed with error', async () => {
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

    it('should not create Channel if createChannel throws', async () => {
        mockConf.createThrows = true;
        const chanWrap = new ChannelWrapper<Channel>(createChannelMock);
        chanWrap.on('error', () => {}); // eslint-disable-line @typescript-eslint/no-empty-function
        await expect(chanWrap.getChannel()).eventually.equal(null);
    });

    it('should not create Channel if close() called before opened', async () => {
        const chanWrap = new ChannelWrapper<Channel>(createChannelMock);
        await chanWrap.close();
        await expect(chanWrap.getChannel()).eventually.equal(null);
    });
});
