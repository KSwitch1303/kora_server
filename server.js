const express = require("express");
const axios = require("axios");
const CryptoJS = require("crypto-js");
require("dotenv").config();

const app = express();
app.use(express.json());

// Your secret key should sit in .env
const SECRET_KEY = process.env.KORAPAY_SECRET_KEY;

// Sign Kora requests
function signData(data) {
    return CryptoJS.HmacSHA256(JSON.stringify(data), SECRET_KEY).toString();
}

// === POST /payout ===
// This will run resolve → payout
app.post("/payout", async (req, res) => {
    try {
        const { bank, account, amount } = req.body;

        if (!bank || !account || !amount) {
            return res.status(400).json({
                status: false,
                message: "bank, account, and amount are required"
            });
        }

        // ===== 1) Resolve Bank Account =====
        const resolvePayload = { bank, account };

        const resolveResponse = await axios.post(
            "https://api.korapay.com/merchant/api/v1/misc/banks/resolve",
            resolvePayload,
            {
                headers: {
                    Authorization: `Bearer ${SECRET_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const { account_name } = resolveResponse.data.data;

        // ===== 2) Create Payout =====
        const payoutPayload = {
            reference: "tx-" + Date.now(),
            amount: amount, // amount in kobo
            currency: "NGN",
            narration: "API Test Payout",
            bank_account: {
                bank: bank,
                account: account,
                name: account_name
            }
        };

        const signature = signData(payoutPayload);

        const payoutResponse = await axios.post(
            "https://api.korapay.com/merchant/api/v1/transactions/disburse",
            payoutPayload,
            {
                headers: {
                    Authorization: `Bearer ${SECRET_KEY}`,
                    "X-Kora-Signature": signature,
                    "Content-Type": "application/json"
                }
            }
        );

        return res.json({
            resolve: resolveResponse.data,
            payout: payoutResponse.data
        });

    } catch (e) {
        return res.status(400).json({
            error: true,
            message: e.response?.data || e.message
        });
    }
});

// Start server
app.listen(3000, () => console.log("Server running on port 3000"));
