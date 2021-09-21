const express = require('express');
const app = express();
const cors = require('cors')
const bodyParser = require('body-parser');
const Blockchain = require('./blockchain');
const uuid = require('uuid/v1');
const port = process.argv[2];


const rp = require('request-promise');
const Hashrate = require('js-hashrate-parser');
const axios = require('axios')
const fs = require('fs');
var CryptoJS = require("crypto-js");
var ip = require("ip");
require('dotenv').config()
const reward = 25

let nodeAddressPrefix = 'tcy'
const characterss ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const charactersLengthh = characterss.length;
	let resultt = '';
    for ( let i = 0; i < 4; i++ ) {
        resultt += characterss.charAt(Math.floor(Math.random() * charactersLengthh));
    }
	var nodepostfix = resultt
const nodeAddress = nodeAddressPrefix + uuid().split('-').join('') + nodepostfix;
let secretPass = (Math.random() + 1).toString(36).substring(7);
var encryption = CryptoJS.AES.encrypt(nodeAddress, secretPass).toString();
fs.writeFile(`./keys/nodekeys/${secretPass}`, encryption, function(err) {
	if(err) {
		return console.log(err);
	}
}); 

const tcy = new Blockchain();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// get entire blockchain
app.post('/node', function (req, res) {
	let secret = req.body.secret
	let encrypted = CryptoJS.AES.encrypt(JSON.stringify(tcy), 'XVTpbdtRQ@2080')
	var decrypted  = CryptoJS.AES.decrypt(encrypted, secret);
	var originalText = decrypted.toString(CryptoJS.enc.Utf8);
  res.send(JSON.parse(originalText));
});

// get number of connected nodes
app.get('/getNodes', function (req, res) {
	let number = tcy.networkNodes.length
	res.send((number).toString());
  });


//New Address
app.post('/getAddress', function (req, res) {
	const addressNotAlreadyPresent = tcy.addresses.indexOf(req.body.newAddress) == -1;
	if (addressNotAlreadyPresent) tcy.addresses.push(req.body.newAddress);

	res.send(` ADDRESS:${req.body.newAddress}`)
  });

// create a new transaction
app.post('/transaction', function(req, res) {
	const newTransaction = req.body;
	const blockIndex = tcy.addTransactionToPendingTransactions(newTransaction);
	res.json({ note: `Transaction will be added in block ${blockIndex}.` });
});


// broadcast transaction
app.post('/transaction/broadcast', function(req, res) {
	if(req.body.sender==='pool'){
		const newTransaction = tcy.createNewTransaction(req.body.amount, req.body.sender, nodeAddress);
		tcy.addTransactionToPendingTransactions(newTransaction);
		let requestPromises = [];
		tcy.networkNodes.forEach(networkNodeUrl => {
			const requestOptions = {
				uri: networkNodeUrl + '/transaction',
				method: 'POST',
				body: newTransaction,
				json: true
			};
	
			requestPromises.push(rp(requestOptions)
			.catch(function (err) {
			})
			)
		});
	
		Promise.all(requestPromises)
		.then(data => {
			res.json({ note: 'Transaction created and broadcast successfully.' });
		});
	}
	else{
	var bytes  = CryptoJS.AES.decrypt(req.body.privatekey.toString(), req.body.pass.toString());
	var originalAddress = bytes.toString(CryptoJS.enc.Utf8);

	if(originalAddress.toString()){
		let address = originalAddress.toString();
		try{
			const addressData = tcy.getAddressData(address);
			if(addressData.returnVal.addressBalance>0){
				const newTransaction = tcy.createNewTransaction(req.body.amount, address, req.body.recipient);
			tcy.addTransactionToPendingTransactions(newTransaction);
			  
			const requestPromises = [];
			tcy.networkNodes.forEach(networkNodeUrl => {
				const requestOptions = {
					uri: networkNodeUrl + '/transaction',
					method: 'POST',
					body: newTransaction,
					json: true
				};
		
				requestPromises.push(rp(requestOptions)
				.catch(function (err) {
				})
				);
			});
		
			Promise.all(requestPromises)
			.then(data => {
				res.json({ note: 'Transaction created and broadcast successfully.' });
			});
			}
			else{
				res.send("Insufficient Fund")
			}
		}
		catch (e) {
			res.send("Address doesn't exist on blockchain")
		}
}
else{
	res.send("Wrong Key or Password")
}
	}
});

// mine a block
app.post('/mine', function(req, res) {
	const lastBlock = tcy.getLastBlock();
	const previousBlockHash = lastBlock['hash'];
	const currentBlockData = {
		transactions: tcy.pendingTransactions,
		index: lastBlock['index'] + 1
	};
	const start = new Date();
	const nonce = tcy.proofOfWork(previousBlockHash, currentBlockData);

	const seconds = (new Date() - start)/(1000);

	const blockHash = tcy.hashBlock(previousBlockHash, currentBlockData, nonce);
	const newBlock = tcy.createNewBlock(nonce, previousBlockHash, blockHash);

	const requestPromises = [];
	tcy.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/receive-new-block',
			method: 'POST',
			body: { newBlock: newBlock },
			json: true
		};

		requestPromises.push(rp(requestOptions)
		.catch(function (err) {
		})
		);
	});

	Promise.all(requestPromises)
	.then(data => {
		const requestOptions = {
			uri: tcy.currentNodeUrl + '/transaction/broadcast',
			method: 'POST',
			body: {
				amount: reward,
				sender: "pool",
				minerAddress: req.body.address.toString()
			},
			json: true
		};

		return rp(requestOptions)
		.catch(function (err) {
		})
	})
	.then(data => {
		const newTransaction = tcy.createNewTransaction((reward-(reward*0.1/100)), nodeAddress, req.body.address.toString());
		tcy.addTransactionToPendingTransactions(newTransaction);
		let requestPromisesreward = [];
		tcy.networkNodes.forEach(networkNodeUrl => {
			const requestOptions = {
				uri: networkNodeUrl + '/transaction',
				method: 'POST',
				body: newTransaction,
				json: true
			};
			requestPromisesreward.push(rp(requestOptions)
		.catch(function (err) {
		})
		);
		axios.post(`${networkNodeUrl}/node`,{secret:"XVTpbdtRQ@2080"})
		.then(response=>{
			let data = JSON.stringify(response.data, null, 2)
			fs.writeFile(`./blocks/data`, data, function(err) {
				if(err) {
					return console.log(err);
				}
			}); 
		})
		.catch(err=>console.log(err))
		})
		axios.post(`${tcy.currentNodeUrl}/node`,{secret:"XVTpbdtRQ@2080"})
		.then(responsee=>{
			let dataq = JSON.stringify(responsee.data, null, 2)
			fs.writeFile(`./blocks/data`, dataq, function(err) {
				if(err) {
					return console.log(err);
				}
			}); 
		})
		res.json({
			note: "New block mined & broadcast successfully",
			block: newBlock,
			hashrate: Hashrate.toString(nonce/seconds)
		});
	});
});


// receive new block
app.post('/receive-new-block', function(req, res) {
	const newBlock = req.body.newBlock;
	const lastBlock = tcy.getLastBlock();
	const correctHash = lastBlock.hash === newBlock.previousBlockHash; 
	const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

	if (correctHash && correctIndex) {
		tcy.chain.push(newBlock);
		tcy.pendingTransactions = [];
		res.json({
			note: 'New block received and accepted.',
			newBlock: newBlock
		});
	} else {
		res.json({
			note: 'New block rejected.',
			newBlock: newBlock
		});
	}
});


// register an address and broadcast it to the network
app.post('/register-and-broadcast-address', function(req, res) {
	var prefix = 'tcy'
	const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const charactersLength = characters.length;
	let result = '';
    for ( let i = 0; i < 4; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
	var postfix = result
	var newAddress = prefix + uuid().split('-').join('')+postfix;
	var secret = req.body.pass
	var ciphertext = CryptoJS.AES.encrypt(newAddress, secret).toString();
	tcy.createAddress(newAddress)

	

	fs.writeFile(`./keys/${newAddress}`, ciphertext, function(err) {
		if(err) {
			return console.log(err);
		}
	}); 
	

	const requestPromises = [];
	tcy.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/getAddress',
			method: 'POST',
			body: {newAddress:newAddress},
			json: true
		};
		requestPromises.push(rp(requestOptions)
		.catch(function (err) {
		})
		);
	});

	Promise.all(requestPromises)
	.then(data => {
		res.json({ Address : `${newAddress}` , PrivateKey: `${ciphertext}`});
	});
});


// register a node and broadcast it the network
app.post('/register-and-broadcast-node', function(req, res) {
	fs.readFile('/root/tcyblockchain_node/Blockchain_Data_Structure/networkNode.js',"utf8", (err, data) => {
		if (err) throw err;
		if(req.body.newNodeUrl === 'http://165.22.191.155:3001' || req.body.newNodeUrl === 'http://165.22.189.5:3001'){
			const newNodeUrl = req.body.newNodeUrl;
		const requests = {
					uri: newNodeUrl + '/register-node',
					method: 'POST',
					body: { newNodeUrl: newNodeUrl },
					json: true
		};
		rp(requests)
		.then(function (connected) {
			if (tcy.networkNodes.indexOf(newNodeUrl) == -1) tcy.networkNodes.push(newNodeUrl);
			const regNodesPromises = [];
			tcy.networkNodes.forEach(networkNodeUrl => {
				const requestOptions = {
					uri: networkNodeUrl + '/register-node',
					method: 'POST',
					body: { newNodeUrl: newNodeUrl },
					json: true
				};
		
				regNodesPromises.push(rp(requestOptions)
				.then(function (success) {
					Promise.all(regNodesPromises)
					.then(data => {
						const bulkRegisterOptions = {
							uri: newNodeUrl + '/register-nodes-bulk',
							method: 'POST',
							body: { allNetworkNodes: [ ...tcy.networkNodes, tcy.currentNodeUrl ] },
							json: true
						};
				
						return rp(bulkRegisterOptions);
					})
					.then(data => {
						res.json({ note: 'New node registered with network successfully.' });
						axios.get(`${newNodeUrl}/consensus`)
						.then(resp=>{
							axios.post(`${newNodeUrl}/node`,{secret:"XVTpbdtRQ@2080"})
							.then(response=>{
								console.log(response)
								let data = JSON.stringify(response.data, null, 2)
								fs.writeFile(`./blocks/data`, data, function(err) {
									if(err) {
										return console.log(err);
									}
								}); 
							})
						})
					});
				})
				.catch(function (err) {
					res.json({ note: 'Unable to connect to server' });
				})
				)
			});
		})
		.catch(function (err) {
			res.json({ note: 'Unable to connect to server' });
		});
		}
	else if(req.body.validity === data && req.body.newNodeUrl != 'http://165.22.191.155:3001'){
	const newNodeUrl = req.body.newNodeUrl;
	const requests = {
				uri: newNodeUrl + '/register-node',
				method: 'POST',
				body: { newNodeUrl: newNodeUrl },
				json: true
	};
	rp(requests)
	.then(function (connected) {
		if (tcy.networkNodes.indexOf(newNodeUrl) == -1) tcy.networkNodes.push(newNodeUrl);
		const regNodesPromises = [];
		tcy.networkNodes.forEach(networkNodeUrl => {
			const requestOptions = {
				uri: networkNodeUrl + '/register-node',
				method: 'POST',
				body: { newNodeUrl: newNodeUrl },
				json: true
			};
	
			regNodesPromises.push(rp(requestOptions)
			.then(function (success) {
				Promise.all(regNodesPromises)
				.then(data => {
					const bulkRegisterOptions = {
						uri: newNodeUrl + '/register-nodes-bulk',
						method: 'POST',
						body: { allNetworkNodes: [ ...tcy.networkNodes, tcy.currentNodeUrl ] },
						json: true
					};
			
					return rp(bulkRegisterOptions);
				})
				.then(data => {
					res.json({ note: 'New node registered with network successfully.' });
					axios.get(`${newNodeUrl}/consensus`)
					.then(resp=>{
						axios.post(`${newNodeUrl}/node`,{secret:"XVTpbdtRQ@2080"})
						.then(response=>{
							console.log(response)
							let data = JSON.stringify(response.data, null, 2)
							fs.writeFile(`./blocks/data`, data, function(err) {
								if(err) {
									return console.log(err);
								}
							}); 
						})
					})
				});
			})
			.catch(function (err) {
				res.json({ note: 'Unable to connect to server' });
			})
			)
		});
    })
    .catch(function (err) {
		res.json({ note: 'Unable to connect to server' });
	});
}
else{
	res.json({ note: 'Node rejected' });
}
	})
});


// register a node with the network
app.post('/register-node', function(req, res) {
	console.log(req.body.newNodeUrl)
	const newNodeUrl = req.body.newNodeUrl;
	const nodeNotAlreadyPresent = tcy.networkNodes.indexOf(newNodeUrl) == -1;
	const notCurrentNode = tcy.currentNodeUrl !== newNodeUrl;
	if (nodeNotAlreadyPresent && notCurrentNode) tcy.networkNodes.push(newNodeUrl);
	res.json({ note: 'New node registered successfully.' });
});


// register multiple nodes at once
app.post('/register-nodes-bulk', function(req, res) {
	const allNetworkNodes = req.body.allNetworkNodes;
	allNetworkNodes.forEach(networkNodeUrl => {
		const nodeNotAlreadyPresent = tcy.networkNodes.indexOf(networkNodeUrl) == -1;
		const notCurrentNode = tcy.currentNodeUrl !== networkNodeUrl;
		if (nodeNotAlreadyPresent && notCurrentNode) tcy.networkNodes.push(networkNodeUrl);
	});

	res.json({ note: 'Bulk registration successful.' });
});


// consensus
app.get('/consensus', function(req, res) {
	const requestPromises = [];
	tcy.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: `${networkNodeUrl}/node` ,
			method: 'POST',
			body: { secret:'XVTpbdtRQ@2080'},
			json: true
		};

		requestPromises.push(rp(requestOptions)
		.catch(function (err) {
			// console.log(err)
		})
		);
	});

	Promise.all(requestPromises)
	.then(blockchains => {
		console.log(blockchains)
		const currentChainLength = tcy.chain.length;
		let maxChainLength = currentChainLength;
		let newLongestChain = null;
		let newPendingTransactions = null;
		let newAddresses = null;

		blockchains.forEach(blockchain => {
			if (blockchain.chain.length > maxChainLength) {
				maxChainLength = blockchain.chain.length;
				newLongestChain = blockchain.chain;
				newPendingTransactions = blockchain.pendingTransactions;
				newAddresses = blockchain.addresses
			};
		});

		if (!newLongestChain || (newLongestChain && !tcy.chainIsValid(newLongestChain))) {
			res.json({
				note: 'Current chain has not been replaced.',
				chain: tcy.chain
			});
		}
		else {
			tcy.chain = newLongestChain;
			tcy.pendingTransactions = newPendingTransactions;
			tcy.addresses = newAddresses
			res.json({
				note: 'This chain has been replaced.',
				chain: tcy.chain
			});
		}
	});
});


// get block by blockHash
app.get('/block/:blockHash', function(req, res) { 
	const blockHash = req.params.blockHash;
	const correctBlock = tcy.getBlock(blockHash);
	res.json({
		block: correctBlock
	});
});


// get transaction by transactionId
app.get('/transaction/:transactionId', function(req, res) {
	const transactionId = req.params.transactionId;
	const trasactionData = tcy.getTransaction(transactionId);
	res.json({
		transaction: trasactionData.transaction,
		block: trasactionData.block
	});
});


// get address by address
app.get('/address/:address', function(req, res) {
	const address = req.params.address;
	const addressData = tcy.getAddressData(address);
	res.json({
		addressData: addressData
	});
});


// block explorer
app.get('/block-explorer', function(req, res) {
	res.sendFile('./block-explorer/index.html', { root: __dirname });
});

//Total supply
app.get('/totalSupply', function(req,res){
	var totalsupply=0;
		axios.post("https://api.tcychain.com/node",{secret:"XVTpbdtRQ@2080"})
		.then(async(ress)=>{
			for(let i = 0;i<ress.data.addresses.length;i++){
				await axios.get(`https://api.tcychain.com/address/${ress.data.addresses[i]}`)
				.then(resp=>{
					totalsupply += resp.data.addressData.returnVal.addressBalance
					if(i===ress.data.addresses.length-1){
						res.send(totalsupply.toString())
					}
				})
			}
			
		})
	}
)

//Total wallets
app.get('/totalWallet', function(req,res){
	var totalsupply=0;
		axios.post("https://api.tcychain.com/node",{secret:"XVTpbdtRQ@2080"})
		.then(ress=>{
			res.send((ress.data.addresses.length).toString())
		})
	}
)

// AUTO NODE ADDITION
function addNodeAuto(){
	fs.readFile('/root/tcyblockchain_node/Blockchain_Data_Structure/networkNode.js',"utf8", (err, data) => {
		if (err) throw err;
					axios.post("https://mainnode.tcychain.com/register-and-broadcast-node",{newNodeUrl:`http://${ip.address()}:3001`,validity:data})
					.then(res=>{
						console.log(res.data)
					})
			})
}
addNodeAuto();


app.listen(port, function() {
	console.log(`Listening on port ${port}...`);
});





