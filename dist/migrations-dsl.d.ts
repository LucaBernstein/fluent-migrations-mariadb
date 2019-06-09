/// <reference types="node" />
import { Connection, ConnectionConfig, MariaDbError } from 'mariadb';
import { EventEmitter } from 'events';
export { MariaDbError, ConnectionConfig };
export declare enum emitType {
    DEBUG = "debug",
    TRACE = "trace",
    ALL = "all"
}
export declare class SqlScript {
    connection: Promise<Connection>;
    schemaVersion: number;
    sqlStatements: string[];
    dbToUse?: Database;
    defaultEmitter: EventEmitter;
    constructor(conf: ConnectionConfig, schemaVersion: number);
    private getConnectionPromise;
    private makeRawSqlRequest;
    private isDatabaseExistent;
    private getDbSchemaVersion;
    getDefaultEmitter(): EventEmitter;
    /**
     * Attach a custom logger to this module. Specify to which kind of logs you want to listen to at least.
     *
     * @param t minimum log level to listen to
     * @param cb callback function
     */
    attachLogger(t: emitType, cb: (...args: any[]) => void): SqlScript;
    /**
     * Select the database to use in this script.
     * It is possible to create a new one if necessary.
     *
     * @param db Database to create or use
     */
    useDatabase(db: Database): SqlScript;
    /**
     * Table to create in the previously specified database
     *
     * @param table
     */
    createTable(table: Table): SqlScript;
    /**
     * As a mitigation for database methods not implemented yet
     *
     * @param sql Raw SQL string to execute.
     */
    addRawSql(sql: string): SqlScript;
    /**
     * Execute the previously generated SQL statements
     *
     * @param increaseVersion If set, the database version number will be incremented by one
     */
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
