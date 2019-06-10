import { describe, beforeEach } from 'mocha';
import { SqlScript, emitType, Database, Table, TableColumnChar } from '../src/migrations-dsl';
import { expect } from 'chai';

describe('test the SqlScript', () => {
    it('should be able to create a database', () => {
        const statements: string[] = new SqlScript({}, 0)
            .useDatabase(new Database('databasename')
                .setCharset('SAMPLECHARSET'))
            .createTable(new Table('SAMPLETABLE')
                .addColumn(new TableColumnChar('TESTCOL', 12)
                    .notNull())
                .definePrimary('TESTCOL'))
            .sqlStatements;

        expect(statements[0]).to.eq('CREATE DATABASE IF NOT EXISTS `databasename` /*!40100 COLLATE \'SAMPLECHARSET\' */;')
        expect(statements[1].trim()).to.eq('CREATE TABLE `databasename`.`SAMPLETABLE` ( `TESTCOL` CHAR(12) NOT NULL\n    , PRIMARY KEY (`TESTCOL`) )\n    COLLATE=\'utf8_general_ci\';'.trim())
    })
})
