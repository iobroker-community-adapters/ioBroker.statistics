![Logo](admin/statistics.png)
# ioBroker.statistics
==================

[![NPM version](http://img.shields.io/npm/v/iobroker.statistics.svg)](https://www.npmjs.com/package/iobroker.statistics)
[![Downloads](https://img.shields.io/npm/dm/iobroker.statistics.svg)](https://www.npmjs.com/package/iobroker.statistics)
[![Build Status](https://travis-ci.org/foxthefox/iobroker.statistics.svg?branch=master)](https://travis-ci.org/foxthefox/iobroker.statistics)

[![NPM](https://nodei.co/npm/iobroker.statistics.png?downloads=true)](https://nodei.co/npm/iobroker.statistics/)

This adapter is a shall make the configuration of statistics more easier. 

## Installation:
Installation requires nodejs v4 at minimum

from npm
```javascript
npm install iobroker.statistics
```
actual version from github (this might not every time work, when development is in progress)
```javascript
npm install https://github.com/foxthefox/ioBroker.statistics/tarball/master --production
```

## Settings
* you have to specify the configuration in the settings of the state
* you have to specify the type of statistical logging you want to have by selecting the options
* you have to specify the relevant groups in admin page, which are available in the settings of the state

choose from the following settings:

* count impulses or on/off switchings
* sumcount, calculate costs from the counted values
* sumdelta, delta between logged analogue values
* sumgroup, sum up of grouped values
* avg, dayly max, min and average
* timecount, how long was status true/ON and how long false/OFF
* 5min,counts within 5 min and dayly max, min and average of it

## Operation
The adapter subscribes to the configured objects and creates his own states in the statistics tree.
2 seperate trees are created:

* statistics.0/save -> final stored values of the timeframe
* statistics.0/temp -> temporary values througout the day

after save or temp the orignal object is kept (unfortunately it is split by the "." in a deeper structure than needed.

## known issues

* groups from admin not yet transferred to the state settings

## Changelog
### 0.0.3
* adminv3 implemented
* complete rewrite to have configuration through the settings of the individual states instead in admin page

#### 0.0.2
* setup running

#### 0.0.1
* initial release 

## License

The MIT License (MIT)

Copyright (c) 2018 foxthefox <foxthefox@wysiwis.net>
