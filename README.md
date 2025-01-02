![Logo](admin/statistics.png)

# ioBroker.statistics

[![NPM version](https://img.shields.io/npm/v/iobroker.statistics?style=flat-square)](https://www.npmjs.com/package/iobroker.statistics)
[![Downloads](https://img.shields.io/npm/dm/iobroker.statistics?label=npm%20downloads&style=flat-square)](https://www.npmjs.com/package/iobroker.statistics)
![node-lts](https://img.shields.io/node/v-lts/iobroker.statistics?style=flat-square)
![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/npm/iobroker.statistics?label=npm%20dependencies&style=flat-square)

![GitHub](https://img.shields.io/github/license/iobroker-community-adapters/iobroker.statistics?style=flat-square)
![GitHub repo size](https://img.shields.io/github/repo-size/iobroker-community-adapters/iobroker.statistics?logo=github&style=flat-square)
![GitHub commit activity](https://img.shields.io/github/commit-activity/m/iobroker-community-adapters/iobroker.statistics?logo=github&style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/iobroker-community-adapters/iobroker.statistics?logo=github&style=flat-square)
![GitHub issues](https://img.shields.io/github/issues/iobroker-community-adapters/iobroker.statistics?logo=github&style=flat-square)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/iobroker-community-adapters/iobroker.statistics/test-and-release.yml?branch=master&logo=github&style=flat-square)

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
### 3.1.0 (2024-11-18)

* (@simatec) Added responsive jsonConfig
* (@klein0r) Copy unit of source state to all statistic states

### 3.0.0 (2024-11-15)
NodeJS >= 18.x and js-controller >= 5 is required

### 2.4.0 (2023-11-03)
NodeJS 16.x is required

* (klein0r) Show error if groups are not configured correctly
* (klein0r) Fixed cron expressions for quarter and year
* (klein0r) Added indicators for startup and working

### 2.3.1 (2023-01-11)
* (klein0r) Added Ukrainian language

### 2.3.0 (2022-11-03)
NodeJS 14.5.0 is required

* (klein0r) Added hourly, weekly, monthly, ... averages
* (klein0r) Added promises to avoid parallel execution of tasks (lead to incorrect calculations)
* (klein0r) Fixed init values for save/temp
* (klein0r) Added option to enable statistics for objects via sendTo
* (klein0r) Allow sum delta to substract values (negative delta)
* (klein0r) Delete states when option in unchecked
* (klein0r) Removed dayMin and dayMax from avg (use minmax for that case!)
* (klein0r) Fix: Calculation of avg when no change of value

## License

The MIT License (MIT)

Copyright (c) 2018-2025 foxthefox <foxthefox@wysiwis.net>,
                        bluefox <dogafox@gmail.com> and
                        Matthias Kleine <info@haus-automatisierung.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
