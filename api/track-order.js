const axios = require('axios');

module.exports = async function handler(req, res) {
  // ─── CORS setup ───
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST from here on
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, orderNumber } = req.body;
  if (!email || !orderNumber) {
    return res.status(400).json({ error: 'Missing email or order number' });
  }

  try {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.SHOPIFY_API_ACCESS_TOKEN;

    console.log(`🔍 Fetching orders for email: ${email}`);

    const response = await axios.get(`https://${shop}/admin/api/2023-07/orders.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      params: {
        email,
        status: 'any'
      }
    });

    const orders = response.data.orders || [];
    if (!orders.length) {
      return res.status(404).json({ error: 'No orders found for this email.' });
    }

    // Normalize order.name by stripping leading '#' if present
    const targetOrder = orders.find(order => {
      const rawName = order.name.startsWith('#')
        ? order.name.slice(1)
        : order.name;
      return rawName === orderNumber;
    });

    if (!targetOrder) {
      return res.status(404).json({ error: `Order ${orderNumber} not found.` });
    }

    console.log(`✅ Found order: ${targetOrder.name}`);
    return res.status(200).json({
      order_number: targetOrder.name,
      status: targetOrder.fulfillment_status || 'Unfulfilled',
      shipping_address: targetOrder.shipping_address || {},
      items: (targetOrder.line_items || []).map(i => ({
        title: i.title,
        quantity: i.quantity
      })),
      tracking_link: targetOrder.fulfillments?.[0]?.tracking_url || null,
      estimated_delivery: targetOrder.processed_at
    });

  } catch (error) {
    console.error('🚨 Error fetching order:', error.message);
    return res.status(500).json({ error: 'Internal server error (fetching orders)' });
  }
};

