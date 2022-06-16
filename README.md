![Logo](admin/statistics.png)

# ioBroker.statistics

[![NPM version](https://img.shields.io/npm/v/iobroker.statistics?style=flat-square)](https://www.npmjs.com/package/iobroker.statistics)
[![Downloads](https://img.shields.io/npm/dm/iobroker.statistics?label=npm%20downloads&style=flat-square)](https://www.npmjs.com/package/iobroker.statistics)
![Snyk Vulnerabilities for npm package](https://img.shields.io/snyk/vulnerabilities/npm/iobroker.statistics?label=npm%20vulnerabilities&style=flat-square)
![node-lts](https://img.shields.io/node/v-lts/iobroker.statistics?style=flat-square)
![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/npm/iobroker.statistics?label=npm%20dependencies&style=flat-square)

![GitHub](https://img.shields.io/github/license/iobroker-community-adapters/iobroker.statistics?style=flat-square)
![GitHub repo size](https://img.shields.io/github/repo-size/iobroker-community-adapters/iobroker.statistics?logo=github&style=flat-square)
![GitHub commit activity](https://img.shields.io/github/commit-activity/m/iobroker-community-adapters/iobroker.statistics?logo=github&style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/iobroker-community-adapters/iobroker.statistics?logo=github&style=flat-square)
![GitHub issues](https://img.shields.io/github/issues/iobroker-community-adapters/iobroker.statistics?logo=github&style=flat-square)
![GitHub Workflow Status](https://img.shields.io/github/workflow/status/iobroker-community-adapters/iobroker.statistics/Test%20and%20Release?label=Test%20and%20Release&logo=github&style=flat-square)
![Snyk Vulnerabilities for GitHub Repo](https://img.shields.io/snyk/vulnerabilities/github/iobroker-community-adapters/iobroker.statistics?label=repo%20vulnerabilities&logo=github&style=flat-square)

## Versions

![Beta](https://img.shields.io/npm/v/iobroker.statistics.svg?color=red&label=beta)
![Stable](http://iobroker.live/badges/statistics-stable.svg)
![Installed](http://iobroker.live/badges/statistics-installed.svg)
[![Translation status](https://weblate.iobroker.net/widgets/adapters/-/statistics/svg-badge.svg)](https://weblate.iobroker.net/engage/adapters/?utm_source=widget)

Statistics adapter for ioBroker (Avg, Sum, Min, Max, ...)

## Installation

Please use the "adapter list" in ioBroker to install a stable version of this adapter. You can also use the CLI to install this adapter:

```
iobroker add statistics
```

## Documentation

[🇺🇸 Documentation](./docs/en/README.md)

[🇩🇪 Dokumentation](./docs/de/README.md)

## Credits

- SVG: https://pixabay.com/de/vectors/diagramm-histogramm-statistiken-3149003/

## Sentry

**This adapter uses Sentry libraries to automatically report exceptions and code errors to the developers.** For more details and for information how to disable the error reporting see [Sentry-Plugin Documentation](https://github.com/ioBroker/plugin-sentry#plugin-sentry)! Sentry reporting is used starting with js-controller 3.0.

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### __WORK IN PROGRESS__
-->
### 2.1.0 (2022-06-16)
* (klein0r) Added support for translated object names
* (klein0r) Fixed sum calculation
* (klein0r) Increased precision to 5 digits
* (klein0r) Translated all objects

### 2.0.0 (2022-06-13)
* (klein0r) Added Admin 5 configuration
* (klein0r) Updated translations

### 1.1.1 (2022-04-17)
* Prevent warn logs when using non-number states as statistic source

### 1.1.0 (2022-03-24)
* IMPORTANT: js-controller 3.2 is needed at least!
* (Apollon77) Prepare for future js-controller compatibility

### 1.0.10 (2021-11-14)
* (Apollon77) prevent some crash cases

## License

The MIT License (MIT)

Copyright (c) 2018-2022 foxthefox <foxthefox@wysiwis.net>,

Copyright (c) 2018-2022 bluefox <dogafox@gmail.com>
