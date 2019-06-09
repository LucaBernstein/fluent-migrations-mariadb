module.exports = {
    "extends": "tslint-config-airbnb",
    "rules": {
        "max-line-length": [
            true,
            130
        ],
        "indent": [
            true,
            "spaces",
            4
        ],
        'ter-indent': [
            true,
            4,
            { 'SwitchCase': 1
            },
        ],
    }
}
