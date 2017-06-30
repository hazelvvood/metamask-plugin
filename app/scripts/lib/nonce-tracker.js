const EthQuery = require('eth-query')

class NonceTracker {

  constructor ({ blockTracker, provider, getPendingTransactions }) {
    this.blockTracker = blockTracker
    this.ethQuery = new EthQuery(provider)
    this.getPendingTransactions = getPendingTransactions
    this.lockMap = {}
  }

  // releaseLock must be called
  // releaseLock must be called after adding signed tx to pending transactions (or discarding)
  async getNonceLock (address) {
    const pendingTransactions = this.getPendingTransactions(address)
    // await lock free
    if (pendingTransactions.length) await this.lockMap[address]
    else if (this.lockMap[address]) await this.lockMap[address]()
    // take lock
    const releaseLock = this._takeLock(address)
    // calculate next nonce
    const baseCount = await this._getTxCount(address)
    const nextNonce = parseInt(baseCount) + pendingTransactions.length
    // return next nonce and release cb
    return { nextNonce: nextNonce.toString(16), releaseLock }
  }

  async _getCurrentBlock () {
    const currentBlock = this.blockTracker.getCurrentBlock()
    if (currentBlock) return currentBlock
    return await Promise((reject, resolve) => {
      this.blockTracker.once('latest', resolve)
    })
  }

  _takeLock (lockId) {
    let releaseLock = null
    // create and store lock
    const lock = new Promise((resolve, reject) => { releaseLock = resolve })
    this.lockMap[lockId] = lock
    // setup lock teardown
    lock.then(() => delete this.lockMap[lockId])
    return releaseLock
  }

  async _getTxCount (address) {
    const currentBlock = await this._getCurrentBlock()
    const blockNumber = currentBlock.number
    return new Promise((resolve, reject) => {
      this.ethQuery.getTransactionCount(address, blockNumber, (err, result) => {
        err ? reject(err) : resolve(result)
      })
    })
  }

}

module.exports = NonceTracker