import mongoose from 'mongoose'
import nodeGeocoder from 'node-geocoder'
import moment from 'moment'
import {head} from 'lodash'

import locationSchema from './location-schema'
import questionnaireValidator from '../lib/questionnaire-validator'

const {Schema} = mongoose

const CustomerSchema = new Schema({
  _id: {
    type: Number,
    ref: 'User'
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  location: locationSchema,
  status: {
    type: String,
    enum: ['Accepted', 'Rejected', 'Pending', 'Inactive'],
    default: 'Pending'
  },
  household: [{
    name: {
      type: String,
      trim: true
    },
    relationship: {
      type: String,
      trim: true
    },
    dateOfBirth: {
      type: Date
    }
  }],
  disclaimerAgree: {
    type: Boolean
  },
  disclaimerSign: {
    type: String,
    trim: true
  },
  lastPacked: {
    type: Date
  },
  packingList: [{
    type: Schema.Types.ObjectId,
    ref: 'FoodItem'
  }],
  lastDelivered: {
    type: Date
  },
  assignedTo: {
    type: Number,
    ref: 'Volunteer'
  },
  foodPreferences: [Schema.Types.ObjectId],
  fields: [{
    meta: {
      type: String,
      required: true
    },
    value: String
  }],
  dateReceived: {
    type: Date,
    default: Date.now
  }
})

CustomerSchema.path('fields')
  .validate(questionnaireValidator('qCustomers'), 'Invalid field')

// Initialize geocoder options for pre save method
const geocoder = nodeGeocoder({
  provider: 'google',
  formatter: null
})

/**
 * Hook a pre save method to construct the geolocation of the address
 */
CustomerSchema.pre('save', function(next) {
  var doc = this
  var address = `${doc.address}, ${doc.city}, ${doc.province}`

  if (process.env.NODE_ENV !== 'production') {
    // doc.location = [0, 0]
    next()
  } else {
    // slow for tests, breaks with fake address
    geocoder.geocode(address, function(err, data) {
      if (!data) return next()

      const {latitude, longitude} = head(data)
      doc.location = {lat: latitude, lng: longitude}

      next()
    })
  }
})

/**
 * Virtual getters & setters
 */
CustomerSchema.virtual('fullName').get(function() {
  var fullName = this.firstName ? this.firstName + ' ' : ''
  fullName += this.middleName ? this.middleName + ' ' : ''
  fullName += this.lastName ? this.lastName : ''
  return fullName
})

CustomerSchema.virtual('householdSummary').get(function() {
  var householdSummary = 'None'

  if (this.household.length) {
    householdSummary = '#' + this.household.length + ' -'
    this.household.forEach(function(dependant) {
      var ageInYears = moment().diff(dependant.dateOfBirth, 'years')
      householdSummary += ' '
      householdSummary += ageInYears ? ageInYears + 'y' : moment().diff(dependant.dateOfBirth, 'months') + 'm'
    })
  }
  return householdSummary
})

/**
 * Schema options
 */
CustomerSchema.set('toJSON', {virtuals: true})

export default mongoose.model('Customer', CustomerSchema)
