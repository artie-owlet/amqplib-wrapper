import EventEmitter from 'events';

import { Channel } from 'amqplib';

export interface IChannelWrapper<ChannelType extends Channel> extends EventEmitter {
    getChannel(): Promise<ChannelType | null>;
    close(): Promise<void>;
}

export class ChannelWrapper<ChannelType extends Channel> extends EventEmitter implements IChannelWrapper<ChannelType> {
    private openPromise: Promise<void>;
    private chan: ChannelType | null = null;
    private closed = false;
    private failed = false;

    constructor(
        private createChannel: () => Promise<ChannelType | null>,
    ) {
        super();
        this.openPromise = this.open();
    }

    public async getChannel(): Promise<ChannelType | null> {
        if (this.closed) {
            return null;
        }
        await this.openPromise;
        return this.chan;
    }

    public async close(): Promise<void> {
        this.closed = true;
        if (this.chan) {
            await this.chan.close();
            this.chan = null;
        }
    }

    private async open(): Promise<void> {
        try {
            this.chan = await this.createChannel();
            if (!this.chan) {
                return;
            }
            this.chan.on('close', this.onClose.bind(this));
            this.chan.on('error', this.onError.bind(this));

            if (this.closed) {
                await this.chan.close();
                this.chan = null;
                return;
            }

            this.emit('open', this.chan);
        } catch (err) {
            this.failed = true;
            this.emit('error', err);
        }
    }

    private onClose(): void {
        this.chan = null;
        this.emit('close');
        if (!this.closed && !this.failed) {
            this.openPromise = this.open();
        }
    }

    private onError(err: Error): void {
        this.failed = true;
        this.emit('error', err);
    }
}
