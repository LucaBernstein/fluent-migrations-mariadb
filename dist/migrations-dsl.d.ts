/// <reference types="node" />
import { Connection, ConnectionConfig } from 'mariadb';
import { EventEmitter } from 'events';
export declare enum emitType {
    DEBUG = "debug",
    TRACE = "trace",
    ALL = "*"
}
export declare class SqlScript {
    connection: Promise<Connection>;
    schemaVersion: number;
    sqlStatements: string[];
    dbToUse?: Database;
    defaultEmitter: EventEmitter;
    constructor(conf: ConnectionConfig, schemaVersion: number);
    getConnectionPromise(conf: ConnectionConfig): Promise<Connection>;
    makeRawSqlRequest(connection: Promise<Connection>, query: string): Promise<any | undefined>;
    isDatabaseExistent(connection: Promise<Connection>, dbName: string): Promise<boolean>;
    getDbSchemaVersion(connection: Promise<Connection>, dbName: string): Promise<number>;
    getDefaultEmitter(): EventEmitter;
    attachLogger(t: emitType, cb: any): SqlScript;
    useDatabase(db: Database): SqlScript;
    createTable(table: Table): SqlScript;
    addRawSql(sql: string): SqlScript;
    execute(increaseVersion?: boolean): Promise<any>;
}
export declare class Table {
    name: string;
    columns: ITableColumn<any>[];
    collation: string;
    primary?: string;
    constructor(name: string);
    addColumn(col: ITableColumn<any>): Table;
    sqlifyColumns(): string;
    definePrimary(primary: string): Table;
    sqlify(databaseToCreateIn: string): string;
}
export interface ITableColumn<T> {
    name: string;
    type?: string;
    length?: number;
    defaultValue?: T | null;
    nullAllowed: boolean;
    setDefaultValue: (t: T) => TableColumn<T>;
    sqlify: () => string;
    notNull: () => TableColumn<T>;
    nullable: (n: boolean) => TableColumn<T>;
}
export declare abstract class TableColumn<T> implements ITableColumn<T> {
    name: string;
    type?: string;
    length?: number;
    defaultValue?: T | null;
    nullAllowed: boolean;
    constructor(name: string);
    setDefaultValue(defaultValue?: T | null): TableColumn<T>;
    notNull(): TableColumn<T>;
    nullable(nullable?: boolean): TableColumn<T>;
    sqlify(): string;
    private getParsedDefaultValue;
}
export declare class TableColumnCustom extends TableColumn<any> {
    sqlPart: string;
    constructor(name: string, sqlPart: string);
    sqlify(): string;
}
export declare class TableColumnChar extends TableColumn<string> {
    type: string;
    length: number;
    defaultValue?: string;
    constructor(name: string, length: number);
}
export declare class Database {
    name: string;
    alreadyExists: boolean;
    collation: string;
    constructor(name: string);
    fromExisting(alreadyExists: boolean): Database;
    setCharset(collation: string): Database;
    sqlify(): string;
}
