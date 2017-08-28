'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    path = require('path'),
    mongoose = require('mongoose'),
    textService = require(path.resolve('./modules/core/server/services/text.server.service')),
    Schema = mongoose.Schema;

/**
 * Create a fuzzy offset between specified distances
 * @param {Number} minimum - Minimal distance
 * @param {Number} maximum - Maximal distance
 * @returns {Array<Number>} - array of length 2 (horizontal and vertical offset)
 */
function fuzzyOffset(minimum, maximum) {
  // Please note that Math.random() is not cryptographically secure.
  // For this purpose it's probably ok, but can be improved i.e. with node crypto module.
  if (maximum < minimum) throw new Error('maximum must be greater than minimum');
  var difference = maximum - minimum;
  var randomDistance = Math.floor(difference * Math.random() + minimum); // Distance will be from interval [minimum, maximum)
  var randomDirection = 2 * Math.PI * Math.random(); // Random direction is from interval [0, 2*PI) radians

  var horizontal = randomDistance * Math.cos(randomDirection);
  var vertical = randomDistance * Math.sin(randomDirection);

  return [horizontal, vertical]; // The order doesn't matter here
}

/**
 * Create a fuzzy location
 * Will create an alternative lat,lng by shifting location 100-200 meters to random direction
 * @link http://gis.stackexchange.com/a/2980
 */
function getFuzzyLocation(location) {

  // Offsets in meters, random between 100-200 meters to random direction
  var offset = fuzzyOffset(100, 200);
  var dn = offset[0];
  var de = offset[1];

  // Position, decimal degrees
  var lat = location[0];
  var lng = location[1];

  // Earth’s radius, sphere
  var Radius = 6378137;

  // Coordinate offsets in radians
  var dLat = dn / Radius;
  var dLng = de / (Radius * Math.cos(Math.PI * lat / 180));

  // OffsetPosition, decimal degrees
  var latO = lat + dLat * 180 / Math.PI;
  var lngO = lng + dLng * 180 / Math.PI;

  return [latO, lngO];
}

/**
 * A Validation function for local strategy properties
 *
 * @param {Array} coordinates - Expects location coordinates in an array: [lat, lon]
 * @returns {Boolean} true on success, false on failure.
 */
var validateLocation = function (coordinates) {

  if (!_.isArray(coordinates) || coordinates.length !== 2) {
    return false;
  }

  if (!_.isFinite(coordinates[0]) || !_.isFinite(coordinates[1])) {
    return false;
  }

  // Test latitude range (-90—+90)
  // Maximum length of digits after `.` is 30
  var latRegexp = /^\(?[+-]?(90(\.0+)?|[1-8]?\d(\.\d{1,30})?)$/;

  // Test longitude range (-180—+180)
  // Maximum length of digits after `.` is 30
  var lonRegexp = /^\s?[+-]?(180(\.0+)?|1[0-7]\d(\.\d+)?|\d{1,2}(\.\d{1,30})?)\)?$/;

  return latRegexp.test(coordinates[0]) && lonRegexp.test(coordinates[1]);
};

/**
 * When `location` is modified, set also `locationFuzzy`
 * Keeps `location` unaltered.
 */
var setLocation = function (value) {
  this.locationFuzzy = getFuzzyLocation(value);
  return value;
};

/**
 * Offers Schema
 */
var OfferSchema = new Schema({
  type: {
    type: String,
    enum: ['host', 'meet'],
    default: 'meet'
  },
  status: {
    type: String,
    enum: ['yes', 'maybe', 'no'],
    default: 'yes'
  },
  description: {
    type: String,
    default: '',
    trim: true,
    set: textService.html
  },
  // This is shown on profiles when users say they are not hosting
  noOfferDescription: {
    type: String,
    default: '',
    trim: true,
    set: textService.html
  },
  maxGuests: {
    type: Number,
    min: 0,
    max: 99,
    default: 1
  },
  // Actual location user has marked
  location: {
    type: [Number],
    required: true,
    validate: [validateLocation, 'Invalid coordinates for location.'],
    set: setLocation
  },
  // This is sent publicly to frontend;
  // some 50-200m fuzzy presentation of actual location
  locationFuzzy: {
    type: [Number]
  },
  updated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date
  },
  user: {
    type: Schema.ObjectId,
    ref: 'User'
  },
  reactivateReminderSent: {
    type: Date
  }
});

// Geospatial index (lat,lon)
OfferSchema.index({ location: '2d' });
OfferSchema.index({ locationFuzzy: '2d' });

mongoose.model('Offer', OfferSchema);
