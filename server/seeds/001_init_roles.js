/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('roles').del();
  
  // Inserts seed entries
  await knex('roles').insert([
    { id: 1, name: 'manager' },
    { id: 2, name: 'employee' }
  ]);
};
