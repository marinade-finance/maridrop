/* eslint-disable no-process-exit */
import {Command} from 'commander';
import {closeTreasury} from './closeTreasury';
import {createPromise} from './createPromise';
import {createTreasury} from './createTreasury';
import {setup} from './global';
import {setPromiseAmount} from './setPromiseAmount';
import { showTreasury } from './slow';

const expandTilde = require('expand-tilde');

const program = new Command();

program
  .version('0.0.1')
  .allowExcessArguments(false)
  .option('-c, --cluster <cluster>', 'Solana cluster', 'devnet')
  .option('--commitment <commitment>', 'Commitment', 'confirmed')
  .option(
    '-k, --keypair <keypair>',
    'Wallet keypair',
    '~/.config/solana/id.json'
  )
  .hook('preAction', setup);

program
  .command('create-treasury')
  .option('-a, --admin <admin>', 'Admin authority')
  .option('--treasury <keypair>', 'Treasury')
  .option('--token-store <keypair>', 'Token store')
  .option(
    '--token-mint <pubkey>',
    'Token mint',
    'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey'
  )
  .option('--start-time <date>', 'Start time')
  .option('--end-time <date>', 'End time')
  .option('-s, --simulate', 'Simulate')
  .action(async options => {
    await createTreasury(options);
  });

program
  .command('create-promise')
  .argument('treasury', 'Treasury')
  .argument('user', 'User')
  .option('-a, --admin <admin>', 'Admin authority')
  .option('-s, --simulate', 'Simulate')
  .action(async (treasury, user, options) => {
    await createPromise(treasury, user, options);
  });

program
  .command('set-promise-amount')
  .argument('treasury', 'Treasury')
  .argument('user', 'User')
  .argument('amount', 'Amount')
  .option('-a, --admin <admin>', 'Admin authority')
  .option('-s, --simulate', 'Simulate')
  .action(async (treasury, user, amount, options) => {
    await setPromiseAmount(treasury, user, amount, options);
  });

program
  .command('close-treasury')
  .argument('treasury', 'Treasury')
  .option(
    '--token-mint <pubkey>',
    'Token mint',
    'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey'
  )
  .option('-a, --admin <admin>', 'Admin authority')
  .option('-s, --simulate', 'Simulate')
  .action(async (treasury, options) => {
    await closeTreasury(treasury, options);
  });

program
  .command('show-treasury')
  .argument('treasury', 'Treasury')
  .action(showTreasury);

program.parseAsync(process.argv).then(
  () => process.exit(),
  (err: unknown) => {
    console.error(err);
    process.exit(-1);
  }
);
