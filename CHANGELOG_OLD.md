# Older changes
## 2.3.0 (2022-11-03)
NodeJS 14.5.0 is required

* (klein0r) Added hourly, weekly, monthly, ... averages
* (klein0r) Added promises to avoid parallel execution of tasks (lead to incorrect calculations)
* (klein0r) Fixed init values for save/temp
* (klein0r) Added option to enable statistics for objects via sendTo
* (klein0r) Allow sum delta to substract values (negative delta)
* (klein0r) Delete states when option in unchecked
* (klein0r) Removed dayMin and dayMax from avg (use minmax for that case!)
* (klein0r) Fix: Calculation of avg when no change of value

## 2.2.0 (2022-07-07)
* (klein0r) Added absolute min and max values

## 2.1.1 (2022-06-16)
* (klein0r) Fixed usage of default values for groups

## 2.1.0 (2022-06-16)
* (klein0r) Added support for translated object names
* (klein0r) Fixed sum calculation
* (klein0r) Increased precision to 5 digits
* (klein0r) Translated all objects

## 2.0.0 (2022-06-13)
* (klein0r) Added Admin 5 configuration
* (klein0r) Updated translations

## 1.1.1 (2022-04-17)
* Prevent warn logs when using non-number states as statistic source

## 1.1.0 (2022-03-24)
* IMPORTANT: js-controller 3.2 is needed at least!
* (Apollon77) Prepare for future js-controller compatibility

## 1.0.10 (2021-11-14)
* (Apollon77) prevent some crash cases

## 1.0.9 (2021-07-29)
* (bluefox) Removed the warnings for js-controller 3.x

## 1.0.6 (2021-05-27)
* (Apollon77) prepare for js-controller 3.3
* (Apollon77) make sure all tasks are processed to prevent missing objects
* (bluefox) added the support of Admin5

## 1.0.4
* (foxthefox) changed the state change to BOTH positive and negative edges, hence it causes a lot of log entries

## 1.0.3 (2021-02-08)
* (Apollon77) fix from sentry crash reports

## 1.0.2 (2021-01-06)
* (foxthefox) try catch around the cronjobs

## 1.0.1 (2020-12-22)
* (Black-Thunder) Precision in rounding set to 4

## 1.0.0 (2020-05-01)
* (bluefox) Caught error if structure is invalid
* (bluefox) Added sentry
* adapter.getObjectView -> controller > 2.0

## 0.2.3 (2020-01-02)
* (HIRSCH-DE) bugfix main.js
* (foxthefox) delete messagehandler

## 0.2.2 (2019-06-29)
* (foxthefox) adapter logs a warning when invalid values arrive and cancels further processing

## 0.2.1 (2019-06-15)
* (foxthefox) correction, timecount value was milliseconds instead seconds
* (foxthefox) other calculations with 2 decimal places after comma
* (foxthefox) min/max for day/week/month/quarter/year
* (foxthefox) set of daily min/max starting point from actual value
* (foxthefox) fixing the PR with dayMin 0 at 00:00
* (foxthefox) improvement for timecount when receiving status updates and no real status change

## 0.2.0 (2019-01-08)
* (foxthefox) compact mode

## 0.1.4 (2019-01-07)
* (foxthefox) license added in io-package.json
* (foxthefox) ReadMe updated
* (foxthefox) type = misc-data

## 0.1.3 (2019-01-06)
* first npm release
* (foxthefox) german doc added
* (foxthefox) error corrections
* (foxthefox) travis testing corrections

## 0.1.2 (2018-09-08)
* (bluefox) total refactoring

## 0.0.3
* admin3 implemented
* complete rewrite to have configuration through the settings of the individual states instead in admin page

## 0.0.2
* setup running

## 0.0.1
* initial release