# Migrations Fluent MariaDB

[![npm version](https://badge.fury.io/js/fluent-migrations-mariadb.svg)](https://badge.fury.io/js/fluent-migrations-mariadb)
[![Build Status](https://travis-ci.org/LucaBernstein/fluent-migrations-mariadb.svg?branch=master)](https://travis-ci.org/LucaBernstein/fluent-migrations-mariadb)
[![Coverage Status](https://coveralls.io/repos/github/LucaBernstein/fluent-migrations-mariadb/badge.svg?branch=master)](https://coveralls.io/github/LucaBernstein/fluent-migrations-mariadb?branch=master) [![Greenkeeper badge](https://badges.greenkeeper.io/LucaBernstein/fluent-migrations-mariadb.svg)](https://greenkeeper.io/)

A simple and chained MariaDB database installation and migrations API.

## Usage

### Sample: Initial database / application creation

This module makes it also simple for you to handle database installations. The following sample code demonstrates this:

```javascript
// 000.initial-db-setup.ts
import { SqlScript, Database, Table, TableColumnChar, TableColumnCustom, emitType, ConnectionConfig, MariaDbError } from 'migrations-fluent-mariadb';
import { LOGGER } from '../../logger';

const conf: ConnectionConfig;
const VERSION: number = 0;

return new SqlScript(conf, VERSION)
    .attachLogger(emitType.ALL, (m) => LOGGER.debug(m)) // Plug in your own logger callback
    .useDatabase(
        new Database('sample-database'),
    )
    .createTable(
        new Table('config')
            .addColumn(
                new TableColumnChar('key', 24)
                    .notNull(),
            )
            .addColumn(
                new TableColumnChar('value', 255)
                    .nullable(),
            )
            .definePrimary('key'),
    )
    // TODO: Remove mitigation and add possibility to add table rows
    .addRawSql(`INSERT INTO \`sample-database\`.\`config\` (\`key\`, \`value\`)
    VALUES ('schemaVersion', '${VERSION}');`)
    .createTable(
        new Table('list-items')
            .addColumn(new TableColumnChar('id', 255).notNull())
            .addColumn(new TableColumnChar('name', 255).nullable().setDefaultValue(null))
            // TODO: Create timestamp type
            .addColumn(new TableColumnCustom('createdOn', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'))
            .addColumn(new TableColumnCustom(
                'lastUpdatedOn',
                'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))
            .definePrimary('id'),
    )
    .execute(false) // increaseVersion is set to false, as we already inserted the version into the config table.
    .catch((e: MariaDbError) => {
        LOGGER.debug(`Error: ${JSON.stringify(e)}`);
        if (e.code === 'ECONNREFUSED') { LOGGER.error(`Connection to database has been refused.\n${e.stack}`); }
    });
```

### Sample: Database migrations

`TODO: Create an example for this passage.`
