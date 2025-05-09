const Knex = require('knex');
const { Model } = require('objection');
const config = require('../knexfile');

// Initialize knex
const knex = Knex(config.development);

// Bind all Models to the knex instance
Model.knex(knex);

module.exports = knex;
