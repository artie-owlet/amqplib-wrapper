import EventEmitter from 'events';

import { Channel } from 'amqplib';

export interface IChannelWrapper<ChannelType extends Channel> extends EventEmitter {
    getChannel(): Promise<ChannelType | null>;
    getChannelSync(): ChannelType | null;
    close(): Promise<void>;
    reset(): Promise<void>;
    on(event: 'open', listener: (chan: ChannelType) => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
}

export class ChannelWrapper<ChannelType extends Channel> extends EventEmitter implements IChannelWrapper<ChannelType> {
    private openPromise: Promise<void>;
    private chan: ChannelType | null = null;
    private closed = false;

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

    public getChannelSync(): ChannelType | null {
        return this.chan;
    }

    public async close(): Promise<void> {
        this.closed = true;
        if (this.chan) {
            await this.chan.close();
        }
    }

    public async reset(): Promise<void> {
        await this.close();
        this.closed = false;
        this.openPromise = this.open();
        await this.openPromise;
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
            this.closed = true;
            this.emit('error', err);
        }
    }

    private onClose(): void {
        this.chan = null;
        if (!this.closed) {
            this.openPromise = Promise.resolve().then(this.open.bind(this));
        }
        this.emit('close');
    }

    private onError(err: Error): void {
        this.closed = true;
        this.emit('error', err);
    }
}
