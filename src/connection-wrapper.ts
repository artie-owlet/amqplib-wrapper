import EventEmitter from 'events';
import { URL } from 'url';

import {
    connect,
    Connection,
    Options,
    Channel,
    ConfirmChannel,
} from 'amqplib';

import { ChannelWrapper } from './channel-wrapper';

export interface IConnectOptions extends Options.Connect {
    reconnectTimeout?: number;
}

async function sleep(ms: number): Promise<void> {
    return new Promise((res) => {
        setTimeout(res, ms);
    });
}

export interface IConnectionWrapper extends EventEmitter {
    createChannelWrapper(): ChannelWrapper<Channel>;
    createConfirmChannelWrapper(): ChannelWrapper<ConfirmChannel>;
    isBlocked(): boolean;
    close(): Promise<void>;
}

export class ConnectionWrapper extends EventEmitter implements IConnectionWrapper {
    private reconnectTimeout?: number;
    private connPromise: Promise<void>;
    private conn: Connection | null = null;
    private blocked = false;
    private closed = false;

    constructor(
        private connectOptions: string | IConnectOptions,
        private socketOptions?: any,
    ) {
        super();

        if (typeof connectOptions === 'string') {
            const url = new URL(connectOptions);
            if (url.searchParams.has('reconnectTimeout')) {
                this.reconnectTimeout = Number(url.searchParams.get('reconnectTimeout'));
            }
        } else {
            this.reconnectTimeout = connectOptions.reconnectTimeout;
        }

        this.connPromise = this.connect();
    }

    public createChannelWrapper(): ChannelWrapper<Channel> {
        return new ChannelWrapper<Channel>(this.createChannel.bind(this));
    }

    public createConfirmChannelWrapper(): ChannelWrapper<ConfirmChannel> {
        return new ChannelWrapper<ConfirmChannel>(this.createConfirmChannel.bind(this));
    }

    public isBlocked(): boolean {
        return this.blocked;
    }

    public async close(): Promise<void> {
        this.closed = true;
        if (this.conn) {
            await this.conn.close();
            this.conn = null;
        }
    }

    private async createChannel(): Promise<Channel | null> {
        await this.connPromise;
        if (this.conn) {
            return this.conn.createChannel();
        }
        return null;
    }

    private async createConfirmChannel(): Promise<ConfirmChannel | null> {
        await this.connPromise;
        if (this.conn) {
            return this.conn.createConfirmChannel();
        }
        return null;
    }

    private async connect(): Promise<void> {
        do {
            try {
                this.conn = await connect(this.connectOptions, this.socketOptions);
                this.conn.on('close', this.onClose.bind(this));
                this.conn.on('error', err => this.emit('error', err));
                this.conn.on('blocked', () => this.blocked = true);
                this.conn.on('unblocked', () => this.blocked = false);

                if (this.closed) {
                    await this.conn.close();
                    this.conn = null;
                    return;
                }

                this.emit('connect', this.conn.connection.serverProperties);
            } catch (err) {
                this.emit('error', err);
                if (!this.closed) {
                    if (this.reconnectTimeout !== undefined) {
                        await sleep(this.reconnectTimeout);
                    } else {
                        this.emit('close');
                        return;
                    }
                } else {
                    this.emit('close');
                }
            }
        } while (!this.conn && !this.closed);
    }

    private onClose(): void {
        this.conn = null;
        this.emit('close');
        if (!this.closed && this.reconnectTimeout !== undefined) {
            this.connPromise = sleep(this.reconnectTimeout).then(this.connect.bind(this));
        }
    }
}
