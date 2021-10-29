import EventEmitter from 'events';
import { URL } from 'url';

import {
    connect,
    Connection,
    Options,
    Channel,
    ConfirmChannel,
    ServerProperties,
} from 'amqplib';

import { ChannelWrapper } from './channel-wrapper';

/**
 * Extends amqplib [Connection options](https://www.squaremobius.net/amqp.node/channel_api.html#connecting-with-an-object-instead-of-a-url)
 */
export interface IConnectOptions extends Options.Connect {
    /**
     * Reconnection timeout in ms (if omitted wrapper will not reconnect)
     */
    reconnectTimeout?: number;
}

async function sleep(ms: number): Promise<void> {
    return new Promise((res) => {
        setTimeout(res, ms);
    });
}

/**
 * Dummy interface describing [[ConnectionWrapper]] events
 */
export interface IConnectionWrapperEvents {
    /**
     * Emitted every time a new connection is opened
     * @param prop peer-properties send by RabbitMQ in start method
     * (see [AMQP reference](https://www.rabbitmq.com/amqp-0-9-1-reference.html#connection.start))
     */
    connect: (prop: ServerProperties) => void;
    /**
     * Emitted when the connection is closed and ConnectionWrapper will not open a new one
     */
    close: () => void;
    /**
     * Connection error
     */
    error: (err: Error) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface ConnectionWrapper {
    /**
     * Events are documented [[IConnectionWrapperEvents | here]]
     */
    on<E extends keyof IConnectionWrapperEvents>(
        event: E,
        listener: IConnectionWrapperEvents[E]
    ): this;
    /**@hidden */
    once<E extends keyof IConnectionWrapperEvents>(
        event: E,
        listener: IConnectionWrapperEvents[E]
    ): this;
    /**@hidden */
    addListener<E extends keyof IConnectionWrapperEvents>(
        event: E,
        listener: IConnectionWrapperEvents[E]
    ): this;
    /**@hidden */
    prependListener<E extends keyof IConnectionWrapperEvents>(
        event: E,
        listener: IConnectionWrapperEvents[E]
    ): this;
    /**@hidden */
    prependOnceListener<E extends keyof IConnectionWrapperEvents>(
        event: E,
        listener: IConnectionWrapperEvents[E]
    ): this;
    /**@hidden */
    emit<E extends keyof IConnectionWrapperEvents>(
        event: E,
        ...params: Parameters<IConnectionWrapperEvents[E]>
    ): boolean;
}

/**
 * Wrapper for amqplib Connection
 */
export class ConnectionWrapper extends EventEmitter {
    private reconnectTimeout?: number;
    private connPromise: Promise<void>;
    private conn: Connection | null = null;
    private blocked = false;
    private closed = false;

    /**
     * Start work
     * @param connectOptions Extends [amqplib connection options](https://www.squaremobius.net/amqp.node/channel_api.html#connect)
     * with additional parameter [[IConnectOptions.reconnectTimeout | reconnectTimeout]] (both AMQP URI and object)
     * @param socketOptions See [amqplib reference](https://www.squaremobius.net/amqp.node/channel_api.html#socket-options)
     */
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

    /**
     * Create wrapper for amqplib Channel
     */
    public createChannelWrapper(): ChannelWrapper<Channel> {
        return new ChannelWrapper<Channel>(this.createChannel.bind(this));
    }

    /**
     * Create wrapper for amqplib ConfirmChannel
     */
    public createConfirmChannelWrapper(): ChannelWrapper<ConfirmChannel> {
        return new ChannelWrapper<ConfirmChannel>(this.createConfirmChannel.bind(this));
    }

    /**
     * Check is connection [blocked](https://www.rabbitmq.com/connection-blocked.html)
     */
    public isBlocked(): boolean {
        return this.blocked;
    }

    /**
     * Stop wrapper and close connection
     */
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
                this.conn.on('error', err => this.emit('error', err as Error));
                this.conn.on('blocked', () => this.blocked = true);
                this.conn.on('unblocked', () => this.blocked = false);

                if (this.closed) {
                    await this.conn.close();
                    this.conn = null;
                    return;
                }

                this.emit('connect', this.conn.connection.serverProperties);
            } catch (err) {
                this.emit('error', err as Error);
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
        if (!this.closed && this.reconnectTimeout !== undefined) {
            this.connPromise = sleep(this.reconnectTimeout).then(this.connect.bind(this));
        } else {
            this.emit('close');
        }
    }
}
