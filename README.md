# Migrations Fluent MariaDB

https://gitlab.com/LucaBernstein/migrations-fluent-mariadb

A chained and simply fluent MariaDB database installation and migrations API.

## Usage

### Sample: Initial database / application creation

This module makes it also simple for you to handle database installations. The following sample code demonstrates this:

```javascript
// 000.initial-db-setup.ts
import { SqlScript, Database, Table, TableColumnChar, TableColumnCustom, emitType } from 'migrations-fluent-mariadb';
import { ConnectionConfig, MariaDbError } from 'mariadb';
import { LOGGER } from '../../logger';

const conf: ConnectionConfig;
const VERSION: number = 0;

return new SqlScript(conf, VERSION)
    .attachLogger(emitType.ALL, LOGGER.debug) // Plug in your own logger callback
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

# Maintaining this module

## Bump version on release

`npm version [<newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease [--preid=<prerelease-id>] | from-git]` (from `npm version --help`)

## Pack .tgz releases locally

`npm pack`

## Custom npm registry

### Reset to default

`npm config set registry https://registry.npmjs.org/`
