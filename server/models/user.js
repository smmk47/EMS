// Use Objection.js for user DB operations
const { Model } = require('objection');

class User extends Model {
  static get tableName() {
    return 'users';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['username', 'password', 'role_id'],
      properties: {
        id: { type: 'integer' },
        username: { type: 'string', minLength: 1, maxLength: 255 },
        password: { type: 'string', minLength: 1 },
        role_id: { type: 'integer' },
        name: { type: ['string', 'null'] },
        email: { type: ['string', 'null'] }
      }
    };
  }

  static get relationMappings() {
    const { Role } = require('./role');
    return {
      role: {
        relation: Model.BelongsToOneRelation,
        modelClass: Role,
        join: {
          from: 'users.role_id',
          to: 'roles.id'
        }
      }
    };
  }

  // Hide password when serializing to JSON
  $formatJson(json) {
    json = super.$formatJson(json);
    delete json.password;
    return json;
  }
}

// Model operations
const createUser = async ({ username, password, role_id, name, email }) => {
  return await User.query().insert({
    username,
    password,
    role_id,
    name,
    email
  });
};

const getUserByUsername = async (username) => {
  return await User.query().findOne({ username }).withGraphFetched('role');
};

const getUserById = async (id) => {
  return await User.query()
    .findById(id)
    .withGraphFetched('role')
    .select('id', 'username', 'role_id', 'name', 'email');
};

const updateUser = async (id, { name, email }) => {
  return await User.query()
    .patchAndFetchById(id, { name, email })
    .select('id', 'username', 'role_id', 'name', 'email');
};

const getAllEmployees = async () => {
  const { Role } = require('./role');
  const employeeRole = await Role.query().findOne({ name: 'employee' });
  return await User.query()
    .where('role_id', employeeRole.id)
    .withGraphFetched('role')
    .select('id', 'username', 'name', 'email');
};

module.exports = {
  User,
  createUser,
  getUserByUsername,
  getUserById,
  updateUser,
  getAllEmployees
};
