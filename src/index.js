const fs = require('fs');
const webpack = require('webpack');
const { createZoneMatchers, cacheFile } = require('./helpers');

function filterData(tzdata, config, file) {
  const moment = require('moment-timezone/moment-timezone-utils');
  const { matchZones, startYear, endYear } = config;
  const newZonesData = tzdata.zones
    .filter(zone =>
      matchZones.find(matcher => matcher.test(zone.split('|')[0]))
    )
    .map(moment.tz.unpack);
  const filteredData = moment.tz.filterLinkPack(
    {
      version: tzdata.version,
      zones: newZonesData,
      links: [],
    },
    startYear,
    endYear
  );
  fs.writeFileSync(file.path, JSON.stringify(filteredData, null, 2));
}

function throwInvalid(message) {
  throw new Error(`MomentTimezoneDataPlugin: ${message}`);
}

function validateOptions(options) {
  const knownOptions = ['matchZones', 'startYear', 'endYear'];
  const optionNames = Object.keys(options);
  let usedOptions = [];
  let unknownOptions = [];
  optionNames.forEach(name => {
    (knownOptions.includes(name) ? usedOptions : unknownOptions).push(name);
  });

  // Unknown options
  if (unknownOptions.length) {
    throwInvalid(
      `Unknown options provided (${unknownOptions.join(', ')}). ` +
      `Supported options are: ${knownOptions.join(', ')}.`
    );
  }

  // At least one option required
  if (!usedOptions.length) {
    throwInvalid('Must provide at least one filtering option.');
  }

  // Invalid years
  ['startYear', 'endYear'].forEach(option => {
    if (option in options && !Number.isInteger(options[option])) {
      throwInvalid(`Invalid option — ${option} must be an integer.`);
    }
  });
}

function MomentTimezoneDataPlugin(options = {}) {
  validateOptions(options);

  const startYear = options.startYear || -Infinity;
  const endYear = options.endYear || Infinity;
  const matchZones = createZoneMatchers(options.matchZones || /./);

  return new webpack.NormalModuleReplacementPlugin(
    /data\/packed\/latest\.json$/,
    resource => {
      if (resource.context.match(/node_modules\/moment-timezone$/)) {
        const config = { matchZones, startYear, endYear };
        const tzdata = require('moment-timezone/data/packed/latest.json');
        const file = cacheFile(tzdata, config);
        if (!file.exists) {
          try {
            filterData(tzdata, config, file);
          } catch (err) {
            console.warn(err);
            return; // Don't rewrite the request
          }
        }
        resource.request = file.path;
      }
    }
  );
}

module.exports = MomentTimezoneDataPlugin;
