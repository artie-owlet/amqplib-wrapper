import EventEmitter from 'events';

export function promisifyEvent<T = void>(em: EventEmitter, event: string): Promise<T> {
    return new Promise((res) => {
        em.once(event, (...args: any[]) => {
            res(args[0]);
        });
    });
}
