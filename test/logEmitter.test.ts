import { describe, beforeEach } from 'mocha';
import { SqlScript, emitType } from '../src/migrations-dsl';
import { expect } from 'chai';
import { EventEmitter } from 'events';

class mockLogger {
    called: number = 0;

    log(...m: any[]): mockLogger {
        console.log(m);
        this.called++; // https://stackoverflow.com/a/20279485/11167453
        return this;
    }
}

describe('test the mock logger', () => {
    it('should count the method calls', () => {
        const LOGGER = new mockLogger().log('Hello World!');
        expect(LOGGER.called).to.eq(1, 'called value should have increased by one.');
    })
})

describe('Migrations DSL', () => {
    it('attachLogger', () => {
        const LOGGER = new mockLogger();
        const calledBefore = LOGGER.called;
        new SqlScript({}, 0)
            .attachLogger(emitType.DEBUG, (m) => LOGGER.log(m));
        expect(LOGGER.called).to.be.greaterThan(calledBefore);
    });
})

describe('blunt eventhandler binding test', () => {
    let LOGGER: mockLogger;
    let e: EventEmitter;

    beforeEach(() => {
        // runs before each test in this block
        LOGGER = new mockLogger();
        e = new EventEmitter();
    });

    it('should work', () => {
        e.on('hello', (m) => { LOGGER.log(m); });
        e.on('again', (m) => { LOGGER.log(m); console.log(`Logger has been called alrady, but once again, with: ${m}`) });
        e.emit('hello', 'THIS IS A TEST(1)');
        e.emit('again', 'THIS IS A TEST(2) AGAIN.');
        expect(LOGGER.called).to.be.eq(2);
    });

    it('should also work with my type enum', () => {
        e.on(emitType.DEBUG, (m) => { LOGGER.log(m) });
        e.emit(emitType.DEBUG, 'DEBUUUUG!!');
        e.emit(emitType.DEBUG, 'How are you doing?');
        expect(LOGGER.called).to.be.eq(2);
    })
})
