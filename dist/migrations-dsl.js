"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var util_1 = require("util");
var mariadb_1 = require("mariadb");
var events_1 = require("events");
// ----- EVENT EMITTER -----
// TODO: Refactor to separate module and import here.
var defaultEmitter = new events_1.EventEmitter();
function getDefaultEmitter() {
    return defaultEmitter;
}
exports.getDefaultEmitter = getDefaultEmitter;
var emitType;
(function (emitType) {
    emitType["DEBUG"] = "debug";
    emitType["TRACE"] = "trace";
})(emitType = exports.emitType || (exports.emitType = {}));
function logCallback(t, cb) {
    defaultEmitter.on(t, cb);
}
exports.logCallback = logCallback;
// ----- MariaDB -----
function getConnectionPromise(conf) {
    var connection = mariadb_1.createConnection(conf);
    return connection;
}
var DbGenerics;
(function (DbGenerics) {
    function makeRawSqlRequest(connection, query) {
        return connection.then(function (conn) {
            return conn.query(query).then(function (res) {
                defaultEmitter.emit(emitType.TRACE, 'RESULT FROM DB:'); // TODO: Make trace
                // TODO: Configure log4js to be able to set only specific classes to listen to TRACE
                defaultEmitter.emit(emitType.TRACE, res);
                defaultEmitter.emit(emitType.TRACE, res[0]);
                return res[0];
            });
        });
    }
    DbGenerics.makeRawSqlRequest = makeRawSqlRequest;
    function isDatabaseExistent(connection, dbName) {
        return makeRawSqlRequest(connection, "SHOW DATABASES LIKE '" + dbName + "'").then(function (res) {
            if (util_1.isNullOrUndefined(res)) {
                return false;
            }
            return res["Database (" + dbName + ")"];
        });
    }
    DbGenerics.isDatabaseExistent = isDatabaseExistent;
    function getDbSchemaVersion(connection, dbName) {
        return makeRawSqlRequest(connection, "SELECT `value` FROM `" + dbName + "`.`config` WHERE `key`=\"schemaVersion\";").then(function (res) {
            if (util_1.isNullOrUndefined(res)) {
                return -1;
            }
            return res.value;
        });
    }
    DbGenerics.getDbSchemaVersion = getDbSchemaVersion;
})(DbGenerics = exports.DbGenerics || (exports.DbGenerics = {}));
var SqlScript = /** @class */ (function () {
    function SqlScript(conf, schemaVersion) {
        this.sqlStatements = [];
        // Provide LOGGER callback to plug into emitter: EventEmitter
        this.schemaVersion = schemaVersion;
        this.connection = getConnectionPromise(conf);
    }
    SqlScript.prototype.useDatabase = function (db) {
        this.dbToUse = db;
        if (!db.alreadyExists) {
            // Create db only if not said to already exist
            this.addRawSql(db.sqlify());
        }
        return this;
    };
    SqlScript.prototype.createTable = function (table) {
        this.addRawSql(table.sqlify(this.dbToUse.name));
        return this;
    };
    SqlScript.prototype.addRawSql = function (sql) {
        defaultEmitter.emit(emitType.TRACE, "Adding SQL statement to queue: " + sql);
        this.sqlStatements.push(sql);
        return this;
    };
    // TODO: Increase schemaVersion config field.
    SqlScript.prototype.execute = function (increaseVersion) {
        var _this = this;
        if (increaseVersion === void 0) { increaseVersion = true; }
        var p = Promise.resolve();
        var currentDbSchemaVersion;
        if (util_1.isNullOrUndefined(this.dbToUse)) {
            throw Error('Please define a database to use!');
        }
        return p.then(function () {
            return DbGenerics.isDatabaseExistent(_this.connection, _this.dbToUse.name)
                .then(function (dbExists) {
                return dbExists;
            });
        }).then(function (dbExists) {
            if (dbExists) {
                return DbGenerics.getDbSchemaVersion(_this.connection, _this.dbToUse.name)
                    .then(function (res) {
                    currentDbSchemaVersion = res;
                });
            }
        }).then(function () {
            return new Promise(function () {
                if (_this.schemaVersion >= currentDbSchemaVersion) {
                    defaultEmitter.emit(emitType.DEBUG, "Not executing migration script to '" + _this.schemaVersion + "',\n                    as database version is already equal or higher ('" + currentDbSchemaVersion + "').");
                }
                else {
                    defaultEmitter.emit(emitType.DEBUG, "Starting database migration from version '" + currentDbSchemaVersion + "'\n                    to version '" + _this.schemaVersion + "'.");
                    // TODO: Implement migration logic
                    // this.sqlStatements
                    _this.connection.then(function (conn) {
                        _this.sqlStatements.forEach(function (e) {
                            p.then(function () {
                                conn.query(e);
                            });
                        });
                    });
                }
            });
        });
    };
    return SqlScript;
}());
exports.SqlScript = SqlScript;
var Table = /** @class */ (function () {
    function Table(name) {
        this.columns = [];
        this.collation = 'utf8_general_ci';
        this.name = name;
    }
    Table.prototype.addColumn = function (col) {
        this.columns.push(col);
        return this;
    };
    Table.prototype.sqlifyColumns = function () {
        var builtSql = '';
        this.columns.forEach(function (element) {
            if (!(builtSql === '')) { // Is not empty anymore
                builtSql += ', ';
            }
            builtSql += element.sqlify();
        });
        if (!util_1.isNullOrUndefined(this.primary)) {
            builtSql += ", PRIMARY KEY (`" + this.primary + "`)";
        }
        return builtSql;
    };
    Table.prototype.definePrimary = function (primary) {
        this.primary = primary;
        return this;
    };
    Table.prototype.sqlify = function (databaseToCreateIn) {
        return "CREATE TABLE `" + databaseToCreateIn + "`.`" + this.name + "` ( " + this.sqlifyColumns() + " )\n    COLLATE='" + this.collation + "';";
    };
    return Table;
}());
exports.Table = Table;
var TableColumn = /** @class */ (function () {
    function TableColumn(name) {
        this.nullAllowed = false;
        this.name = name;
    }
    TableColumn.prototype.setDefaultValue = function (defaultValue) {
        // Can also undefine variable like this: Pass no param.
        this.defaultValue = defaultValue;
        return this;
    };
    TableColumn.prototype.notNull = function () {
        this.nullAllowed = false;
        return this;
    };
    TableColumn.prototype.nullable = function (nullable) {
        if (nullable === void 0) { nullable = true; }
        this.nullAllowed = nullable;
        return this;
    };
    TableColumn.prototype.sqlify = function () {
        return "`" + this.name + "` " + this.type + "(" + this.length + ") " + (this.nullAllowed ? 'NULL' : 'NOT NULL') + "\n    " + this.getParsedDefaultValue();
    };
    TableColumn.prototype.getParsedDefaultValue = function () {
        if (!util_1.isNullOrUndefined(this.defaultValue)) {
            return "DEFAULT " + this.defaultValue;
        }
        if (util_1.isNull(this.defaultValue)) {
            return 'DEFAULT NULL';
        }
        return '';
    };
    return TableColumn;
}());
exports.TableColumn = TableColumn;
var TableColumnCustom = /** @class */ (function (_super) {
    __extends(TableColumnCustom, _super);
    function TableColumnCustom(name, sqlPart) {
        var _this = _super.call(this, name) || this;
        _this.sqlPart = sqlPart;
        return _this;
    }
    TableColumnCustom.prototype.sqlify = function () {
        return "`" + this.name + "` " + this.sqlPart;
    };
    return TableColumnCustom;
}(TableColumn));
exports.TableColumnCustom = TableColumnCustom;
var TableColumnChar = /** @class */ (function (_super) {
    __extends(TableColumnChar, _super);
    function TableColumnChar(name, length) {
        var _this = _super.call(this, name) || this;
        _this.type = 'CHAR';
        _this.length = length;
        return _this;
    }
    return TableColumnChar;
}(TableColumn));
exports.TableColumnChar = TableColumnChar;
var Database = /** @class */ (function () {
    function Database(name) {
        this.alreadyExists = false;
        this.collation = 'utf8_general_ci';
        this.name = name;
        return this;
    }
    Database.prototype.fromExisting = function (alreadyExists) {
        this.alreadyExists = alreadyExists;
        // TODO: Check if database already exists with properties we like to have
        return this;
    };
    Database.prototype.setCharset = function (collation) {
        this.collation = collation;
        return this;
    };
    Database.prototype.sqlify = function () {
        return "CREATE DATABASE IF NOT EXISTS `" + this.name + "` /*!40100 COLLATE '" + this.collation + "' */;";
    };
    return Database;
}());
exports.Database = Database;
