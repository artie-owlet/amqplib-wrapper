import EventEmitter from 'events';

import { Channel } from 'amqplib';

/**
 * Dummy interface describing [[ChannelWrapper]] events
 */
export interface IChannelWrapperEvents<ChannelType extends Channel> {
    /**
     * Emitted every time a new channel is opened
     */
    open: (chan: ChannelType) => void;
    /**
     * Emitted when the channel is closed and ChannelWrapper will not open a new one
     */
    close: () => void;
    /**
     * Channel error
     */
    error: (err: Error) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface ChannelWrapper<ChannelType extends Channel> {
    /**
     * Events are documented [[IChannelWrapperEvents | here]]
     */
    on<E extends keyof IChannelWrapperEvents<ChannelType>>(
        event: E,
        listener: IChannelWrapperEvents<ChannelType>[E]
    ): this;
    /**@hidden */
    once<E extends keyof IChannelWrapperEvents<ChannelType>>(
        event: E,
        listener: IChannelWrapperEvents<ChannelType>[E]
    ): this;
    /**@hidden */
    addListener<E extends keyof IChannelWrapperEvents<ChannelType>>(
        event: E,
        listener: IChannelWrapperEvents<ChannelType>[E]
    ): this;
    /**@hidden */
    prependListener<E extends keyof IChannelWrapperEvents<ChannelType>>(
        event: E,
        listener: IChannelWrapperEvents<ChannelType>[E]
    ): this;
    /**@hidden */
    prependOnceListener<E extends keyof IChannelWrapperEvents<ChannelType>>(
        event: E,
        listener: IChannelWrapperEvents<ChannelType>[E]
    ): this;
    /**@hidden */
    emit<E extends keyof IChannelWrapperEvents<ChannelType>>(
        event: E,
        ...params: Parameters<IChannelWrapperEvents<ChannelType>[E]>
    ): boolean;
}

/**
 * Wrapper for amqplib Channel
 */
export class ChannelWrapper<ChannelType extends Channel> extends EventEmitter {
    private openPromise: Promise<void>;
    private chan: ChannelType | null = null;
    private closed = false;

    /**
     * @hidden
     */
    constructor(
        private createChannel: () => Promise<ChannelType | null>,
    ) {
        super();
        this.openPromise = this.open();
    }

    /**
     * Get amqplib Channel (or ConfirmChannel). Returns `null` if channel was closed with error or manually
     */
    public async getChannel(): Promise<ChannelType | null> {
        if (this.closed) {
            return null;
        }
        await this.openPromise;
        return this.chan;
    }

    /**
     * Returns channel if it is currently open, otherwise `null`
     */
    public getChannelSync(): ChannelType | null {
        return this.chan;
    }

    /**
     * Stop wrapper and close channel
     */
    public async close(): Promise<void> {
        this.closed = true;
        if (this.chan) {
            await this.chan.close();
        }
    }

    /**
     * Close channel and open a new one
     */
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
            this.emit('error', err as Error);
        }
    }

    private onClose(): void {
        this.chan = null;
        if (!this.closed) {
            this.openPromise = Promise.resolve().then(this.open.bind(this));
        } else {
            this.emit('close');
        }
    }

    private onError(err: Error): void {
        this.closed = true;
        this.emit('error', err);
    }
}
