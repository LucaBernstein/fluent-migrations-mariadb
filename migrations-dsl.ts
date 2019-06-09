import { isNullOrUndefined, isNull } from 'util';
import { Connection, ConnectionConfig, createConnection } from 'mariadb';
import { EventEmitter } from 'events';

const emitter = new EventEmitter();

function getConnectionPromise(conf: ConnectionConfig): Promise<Connection> {
    const connection: Promise<Connection> = createConnection(conf);
    return connection;
}

export module DbGenerics {
    export function makeRawSqlRequest(
        connection: Promise<Connection>,
        query: string): Promise<any | undefined> {
        return connection.then((conn) => {
            return conn.query(query).then((res) => {
                emitter.emit('trace', 'RESULT FROM DB:'); // TODO: Make trace
                // TODO: Configure log4js to be able to set only specific classes to listen to TRACE
                emitter.emit('trace', res);
                emitter.emit('trace', res[0]);
                return res[0];
            });
        });
    }

    export function isDatabaseExistent(connection: Promise<Connection>, dbName: string): Promise<boolean> {
        return makeRawSqlRequest(
            connection,
            `SHOW DATABASES LIKE '${dbName}'`,
        ).then((res) => {
            if (isNullOrUndefined(res)) {
                return false;
            }
            return res[`Database (${dbName})`];
        });
    }

    export function getDbSchemaVersion(connection: Promise<Connection>, dbName: string): Promise<number> {
        return makeRawSqlRequest(
            connection,
            `SELECT \`value\` FROM \`${dbName}\`.\`config\` WHERE \`key\`="schemaVersion";`,
        ).then((res) => {
            if (isNullOrUndefined(res)) {
                return -1;
            }
            return res!.value;
        });
    }
}

export class SqlScript { // TODO: implements Promise<any>
    connection: Promise<Connection>;

    schemaVersion: number;
    sqlStatements: string[] = [];
    dbToUse?: Database;

    constructor(conf: ConnectionConfig, schemaVersion: number) {
        this.schemaVersion = schemaVersion;
        this.connection = getConnectionPromise(conf);
    }

    useDatabase(db: Database): SqlScript {
        this.dbToUse = db;
        if (!db.alreadyExists) {
            // Create db only if not said to already exist
            this.addRawSql(db.sqlify());
        }
        return this;
    }

    createTable(table: Table) {
        this.addRawSql(table.sqlify(this.dbToUse!.name));
        return this;
    }

    addRawSql(sql: string): SqlScript {
        emitter.emit('trace', `Adding SQL statement to queue: ${sql}`);
        this.sqlStatements.push(sql);
        return this;

    }

    // TODO: Increase schemaVersion config field.
    execute(increaseVersion: boolean = true): Promise<any> {
        const p = Promise.resolve();
        let currentDbSchemaVersion: number;
        if (isNullOrUndefined(this.dbToUse)) {
            throw Error('Please define a database to use!');
        }
        return p.then(() => {
            return DbGenerics.isDatabaseExistent(this.connection, this.dbToUse!.name)
                .then((dbExists) => {
                    return dbExists;
                });
        }).then((dbExists) => {
            if (dbExists) {
                return DbGenerics.getDbSchemaVersion(this.connection, this.dbToUse!.name)
                    .then((res) => {
                        currentDbSchemaVersion = res;
                    });
            }
        }).then(() => {
            return new Promise(() => {
                if (this.schemaVersion >= currentDbSchemaVersion) {
                    emitter.emit('debug', `Not executing migration script to '${this.schemaVersion}',
                    as database version is already equal or higher ('${currentDbSchemaVersion}').`);
                } else {
                    emitter.emit('debug', `Starting database migration from version '${currentDbSchemaVersion}'
                    to version '${this.schemaVersion}'.`);
                    // TODO: Implement migration logic
                    // this.sqlStatements
                    this.connection.then((conn) => {
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
}

export class Table {
    name: string;
    columns: ITableColumn<any>[] = [];
    collation: string = 'utf8_general_ci';
    primary?: string;

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

export abstract class TableColumn<T> implements ITableColumn<T> {
    name: string;
    type?: string;
    length?: number;
    defaultValue?: T | null;
    nullAllowed: boolean = false;

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
    // TODO: Remove, was implemented to save time in the beginning
    sqlPart: string;
    constructor(name: string, sqlPart: string) {
        super(name);
        this.sqlPart = sqlPart;
    }

    sqlify(): string {
        return `\`${this.name}\` ${this.sqlPart}`;
    }
}

export class TableColumnChar extends TableColumn<string> {
    type: string = 'CHAR';
    length: number;
    defaultValue?: string;

    constructor(name: string, length: number) {
        super(name);
        this.length = length;
    }
}

export class Database {
    name: string;
    alreadyExists: boolean = false;
    collation: string = 'utf8_general_ci';

    constructor(name: string) {
        this.name = name;
        return this;
    }

    fromExisting(alreadyExists: boolean): Database { // TODO: Maybe remove, as no use case
        this.alreadyExists = alreadyExists;
        // TODO: Check if database already exists with properties we like to have
        return this;
    }

    setCharset(collation: string): Database {
        this.collation = collation;
        return this;
    }

    sqlify(): string {
        return `CREATE DATABASE IF NOT EXISTS \`${this.name}\` /*!40100 COLLATE '${this.collation}' */;`;
    }
}
