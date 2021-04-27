require('dotenv').config();
const ccxt = require('ccxt');
const axios = require('axios');

const api_key = process.env.API_KEY;
const secret_key = process.env.SECRET_KEY;

const coinGeckoApi =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true';

const ticker = async (config, binanceClient) => {
  try {
    const { asset, base, allocation, spread } = config;
    const market = `${asset}/${base}`;

    const orders = await binanceClient.fetchOpenOrders(market);
    orders.forEach(async (order) => {
      await binanceClient.cancelOrder(order.id);
    });

    const results = await Promise.all([
      axios.get(coinGeckoApi),
      axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true'
      ),
    ]);

    const marketPrice =
      results[0].data.bitcoin.usd / results[1].data.tether.usd;

    const sellPrice = marketPrice * (1 + spread);
    const buyPrice = marketPrice * (1 - spread);
    const balance = await binanceClient.fetchBalance();
    const assetBalance = balance.free[asset];
    const baseBalance = balance.free[base];
    const sellVolume = assetBalance * allocation;
    const buyVolume = (baseBalance * allocation) / marketPrice;

    await binanceClient.createLimitSellOrder(market, sellVolume, sellPrice);
    await binanceClient.createLimitBuyOrder(market, buyVolume, buyPrice);

    console.log(
      `New tick for ${market}... 
    Created limit sell order for ${sellVolume} @ ${sellPrice} 
    Created limit buy order for ${buyVolume} @ ${buyPrice}`
    );
  } catch (error) {
    console.log(error);
  }
};

const run = () => {
  const config = {
    asset: 'BTC',
    base: 'USDT',
    allocation: 0.1,
    spread: 0.2,
    tickInterval: 2000,
  };

  const binanceClient = new ccxt.binanceus({
    apiKey: api_key,
    secret: secret_key,
  });

  ticker(config, binanceClient);
  setInterval(ticker, config.tickInterval, config, binanceClient);
};

run();
