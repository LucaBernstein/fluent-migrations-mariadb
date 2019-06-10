import { isNullOrUndefined, isNull } from 'util';
import { Connection, ConnectionConfig, createConnection, MariaDbError } from 'mariadb';
import { EventEmitter } from 'events';

// The following types are likely to be needed / used:
export { MariaDbError, ConnectionConfig };

export enum emitType {
    // Make lists to attach always log levels UP TO selected one: dynamically and recursively build.
    DEBUG = 'debug',
    TRACE = 'trace',
    ALL = 'all',
}

export class SqlScript { // TODO: implements Promise<any>
    private connection?: Promise<Connection>;

    private schemaVersion: number;
    protected sqlStatements: string[] = [];
    private dbToUse?: Database;

    private conf: ConnectionConfig;

    // TODO: Refactor event emitter to separate module and import here.
    private logEmitter?: EventEmitter;

    constructor(conf: ConnectionConfig, schemaVersion: number) {
        // Provide LOGGER callback to plug into emitter: EventEmitter
        this.schemaVersion = schemaVersion;
        this.conf = conf;
    }

    private getConnectionPromise(): Promise<Connection> {
        // Lazy load connection
        if (!this.connection) {
            this.connection = createConnection(this.conf);
        }
        return this.connection;
    }

    /**
     * Protect lazy initialization of logEmitter.
     *
     * @see SqlScript#attachLogger
     */
    private emitLogIfLoggerAttached(t: emitType, m: string): SqlScript {
        if (this.logEmitter !== undefined) {
            this.logEmitter.emit(t, m);
        }
        return this;
    }

    private makeRawSqlRequest(
        connection: Promise<Connection>,
        query: string): Promise<any | undefined> {
        return connection.then((conn) => {
            return conn.query(query).then((res) => {
                this.emitLogIfLoggerAttached(emitType.TRACE, 'RESULT FROM DB:'); // TODO: Make trace
                // TODO: Configure log4js to be able to set only specific classes to listen to TRACE
                this.emitLogIfLoggerAttached(emitType.TRACE, res);
                this.emitLogIfLoggerAttached(emitType.TRACE, res[0]);
                return res[0];
            });
        });
    }

    private isDatabaseExistent(connection: Promise<Connection>, dbName: string): Promise<boolean> {
        return this.makeRawSqlRequest(
            connection,
            `SHOW DATABASES LIKE '${dbName}'`,
        ).then((res) => {
            if (isNullOrUndefined(res)) {
                return false;
            }
            return res[`Database (${dbName})`];
        });
    }

    private getDbSchemaVersion(connection: Promise<Connection>, dbName: string): Promise<number> {
        return this.makeRawSqlRequest(
            connection,
            `SELECT \`value\` FROM \`${dbName}\`.\`config\` WHERE \`key\`="schemaVersion";`,
        ).then((res) => {
            if (isNullOrUndefined(res)) {
                return -1;
            }
            return res!.value;
        });
    }

    /**
     * Attach a custom logger to this module. Specify to which kind of logs you want to listen to at least.
     * Lazy load emitter, only if needed
     *
     * @param t minimum log level to listen to
     * @param cb callback function
     */
    attachLogger(t: emitType, cb: (m: any) => any): SqlScript {
        // Lazy load event emitter
        if (this.logEmitter === undefined) {
            this.logEmitter = new EventEmitter();
        }
        if (t === emitType.ALL) {
            Object.values(emitType).forEach((element) => {
                this.logEmitter!.on(element, (m) => { cb(m); });
            });
        } else {
            this.logEmitter.on(t, (m) => { cb(m); });
        }
        this.emitLogIfLoggerAttached(t, `Logging ${t} events to custom logger.`);
        return this;
    }

    /**
     * Select the database to use in this script.
     * It is possible to create a new one if necessary.
     *
     * @param db Database to create or use
     */
    useDatabase(db: Database): SqlScript {
        this.dbToUse = db;
        this.addRawSql(db.sqlify());
        return this;
    }

    /**
     * Table to create in the previously specified database
     *
     * @param table
     */
    createTable(table: Table): SqlScript {
        this.addRawSql(table.sqlify(this.dbToUse!.getName()));
        return this;
    }

    /**
     * As a mitigation for database methods not implemented yet
     *
     * @param sql Raw SQL string to execute.
     */
    addRawSql(sql: string): SqlScript {
        this.emitLogIfLoggerAttached(emitType.TRACE, `Adding SQL statement to queue: ${sql}`);
        this.sqlStatements.push(sql);
        return this;
    }

    /**
     * Execute the previously generated SQL statements
     *
     * @param increaseVersion If set, the database version number will be incremented by one
     */
    execute(increaseVersion: boolean = true): Promise<any> {
        // TODO: Increase schemaVersion config field: Implement
        const p = Promise.resolve();
        let currentDbSchemaVersion: number;
        if (isNullOrUndefined(this.dbToUse)) {
            throw Error('Please define a database to use!');
        }
        return p.then(() => {
            return this.isDatabaseExistent(this.getConnectionPromise(), this.dbToUse!.getName())
                .then((dbExists) => {
                    return dbExists;
                });
        }).then((dbExists) => {
            if (dbExists) {
                return this.getDbSchemaVersion(this.getConnectionPromise(), this.dbToUse!.getName())
                    .then((res) => {
                        currentDbSchemaVersion = res;
                    });
            }
        }).then(() => {
            return new Promise(() => {
                if (this.schemaVersion >= currentDbSchemaVersion) {
                    /* tslint:disable:max-line-length  */
                    this.emitLogIfLoggerAttached(emitType.DEBUG, `Not executing migration script to '${this.schemaVersion}', as database version is already equal or higher ('${currentDbSchemaVersion}').`);
                    /* tslint:enable */
                } else {
                    /* tslint:disable:max-line-length  */
                    this.emitLogIfLoggerAttached(emitType.DEBUG, `Starting database migration from version '${currentDbSchemaVersion}' to version '${this.schemaVersion}'.`);
                    /* tslint:enable */
                    // TODO: Implement migration logic
                    // this.sqlStatements
                    this.getConnectionPromise().then((conn) => {
                        this.sqlStatements.forEach((e) => {
                            p.then(() => {
                                conn.query(e);
                            });
                        });
                    });
                }
            });
        });
    }

    getRawSqlStatements(): string[] {
        return this.sqlStatements;
    }
}

export class Table {
    private name: string;
    private columns: ITableColumn<any>[] = [];
    private collation: string = 'utf8_general_ci';
    private primary?: string;

    constructor(name: string) {
        this.name = name;
    }

    addColumn(col: ITableColumn<any>): Table {
        this.columns.push(col);
        return this;
    }

    sqlifyColumns(): string {
        let builtSql: string = '';
        this.columns.forEach((element) => {
            if (!(builtSql === '')) { // Is not empty anymore
                builtSql += ', ';
            }
            builtSql += element.sqlify();
        });
        if (!isNullOrUndefined(this.primary)) {
            builtSql += `, PRIMARY KEY (\`${this.primary}\`)`;
        }
        return builtSql;
    }

    definePrimary(primary: string): Table {
        this.primary = primary;
        return this;
    }

    sqlify(databaseToCreateIn: string): string {
        return `CREATE TABLE \`${databaseToCreateIn}\`.\`${this.name}\` ( ${this.sqlifyColumns()} )
    COLLATE='${this.collation}';`;
    }
}

export interface ITableColumn<T> {
    // TODO: Make primary selection on column directly
    setDefaultValue: (t: T) => TableColumn<T>;
    sqlify: () => string;
    notNull: () => TableColumn<T>;
    nullable: (n: boolean) => TableColumn<T>;
}

export abstract class TableColumn<T> implements ITableColumn<T> {
    protected name: string;
    protected type?: string;
    protected length?: number;
    protected defaultValue?: T | null;
    protected nullAllowed: boolean = false;

    constructor(name: string) {
        this.name = name;
    }

    setDefaultValue(defaultValue?: T | null): TableColumn<T> {
        // Can also undefine variable like this: Pass no param.
        this.defaultValue = defaultValue;
        return this;
    }

    notNull(): TableColumn<T> {
        this.nullAllowed = false;
        return this;
    }

    nullable(nullable: boolean = true): TableColumn<T> {
        this.nullAllowed = nullable;
        return this;
    }

    sqlify(): string {
        return `\`${this.name}\` ${this.type}(${this.length}) ${this.nullAllowed ? 'NULL' : 'NOT NULL'}
    ${this.getParsedDefaultValue()}`;
    }

    private getParsedDefaultValue(): string {
        if (!isNullOrUndefined(this.defaultValue)) {
            return `DEFAULT ${<string><unknown>this.defaultValue}`;
        } if (isNull(this.defaultValue)) {
            return 'DEFAULT NULL';
        }
        return '';

    }
}

export class TableColumnCustom extends TableColumn<any> {
    // TODO: Remove, as it was implemented to save time in the beginning
    private sqlPart: string;

    constructor(name: string, sqlPart: string) {
        super(name);
        this.sqlPart = sqlPart;
    }

    sqlify(): string {
        return `\`${this.name}\` ${this.sqlPart}`;
    }
}

export class TableColumnChar extends TableColumn<string> {
    protected type: string = 'CHAR';
    protected length: number;
    protected defaultValue?: string;

    constructor(name: string, length: number) {
        super(name);
        this.length = length;
    }
}

export class Database {
    private name: string;
    private collation: string = 'utf8_general_ci';

    constructor(name: string) {
        this.name = name;
        return this;
    }

    setCharset(collation: string): Database {
        this.collation = collation;
        return this;
    }

    sqlify(): string {
        return `CREATE DATABASE IF NOT EXISTS \`${this.name}\` /*!40100 COLLATE '${this.collation}' */;`;
    }

    getName(): string {
        return this.name;
    }
}
