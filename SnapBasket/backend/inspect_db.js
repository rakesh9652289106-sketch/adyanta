const { db } = require('./db');

db.all("SELECT id, vendor_id, name, status FROM shops", [], (err, rows) => {
    if (err) console.error("Error querying shops:", err);
    console.log("SHOPS:", JSON.stringify(rows, null, 2));
    
    db.all("SELECT * FROM vendor_admin_messages", [], (err2, msgs) => {
        if (err2) console.error("Error querying messages:", err2);
        console.log("MESSAGES:", JSON.stringify(msgs, null, 2));
        process.exit(0);
    });
});
