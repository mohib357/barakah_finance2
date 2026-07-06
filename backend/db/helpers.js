// C:\Project\barakah_finance2\backend\db\helpers.js

function dbGet(db, collection) {
    return {
        value: () => db.data[collection],
        find: (query) => {
            const items = db.data[collection] || [];
            if (typeof query === 'function') {
                return { value: () => items.find(query) };
            }
            return {
                value: () => items.find(item => {
                    return Object.keys(query).every(key => item[key] === query[key]);
                }),
                assign: (updates) => {
                    const item = items.find(item => {
                        return Object.keys(query).every(key => item[key] === query[key]);
                    });
                    if (item) {
                        Object.assign(item, updates);
                    }
                    return { write: () => db.write() };
                }
            };
        },
        push: (item) => {
            db.data[collection] = db.data[collection] || [];
            db.data[collection].push(item);
            return { write: () => db.write() };
        },
        remove: (query) => {
            const items = db.data[collection] || [];
            if (typeof query === 'function') {
                db.data[collection] = items.filter(item => !query(item));
            } else {
                db.data[collection] = items.filter(item => {
                    return !Object.keys(query).every(key => item[key] === query[key]);
                });
            }
            return { write: () => db.write() };
        }
    };
}

module.exports = { dbGet };
