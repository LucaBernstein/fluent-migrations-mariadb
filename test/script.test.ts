import { describe } from 'mocha';
import { SqlScript, emitType, Database, Table, TableColumnChar, TableColumnCustom } from '../src/migrations-dsl';
import { expect } from 'chai';

function forceHardSanitize(sql: string): string {
    return sql
        .replace(/\n/g, '')
        .replace(/ /g, '')
        .trim()
        ;
}

describe('test the SqlScript', () => {
    it('create sample SQL statements', () => {
        const statements: string[] = new SqlScript({}, 0)
            .useDatabase(new Database('databasename')
                .setCharset('SAMPLECHARSET'))
            .createTable(new Table('SAMPLETABLE')
                .addColumn(new TableColumnChar('TESTCOL', 12)
                    .notNull())
                .definePrimary('TESTCOL'))
            .getRawSqlStatements();

        expect(statements[0]).to.eq('CREATE DATABASE IF NOT EXISTS `databasename` /*!40100 COLLATE \'SAMPLECHARSET\' */;')
        expect(forceHardSanitize(statements[1])).to.eq(forceHardSanitize('CREATE TABLE `databasename`.`SAMPLETABLE` ( `TESTCOL` CHAR(12) NOT NULL, PRIMARY KEY (`TESTCOL`) ) COLLATE=\'utf8_general_ci\';'))
    })

    it('create table SQL statements with columns', () => {
        const statements: string = new Table('SAMPLETABLE')
            .addColumn(new TableColumnChar('TESTCOL', 12)
                .notNull()
                .setDefaultValue('HALLOWELT'))
            .addColumn(new TableColumnChar('TESTCOL1', 24)
                .nullable()
                .setDefaultValue(null))
            .addColumn(new TableColumnCustom('TESTCOL2CUSTOM', 'SQLPART')
                .nullable())
            .sqlifyColumns()
        expect(forceHardSanitize(statements)).to.eq(forceHardSanitize('`TESTCOL` CHAR(12) NOT NULL DEFAULT HALLOWELT, `TESTCOL1` CHAR(24) NULL DEFAULT NULL, `TESTCOL2CUSTOM` SQLPART'));
    })
})
