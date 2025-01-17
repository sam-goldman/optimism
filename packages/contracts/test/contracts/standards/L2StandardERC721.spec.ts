/* External Imports */
import { ethers } from 'hardhat'
import { Signer, Contract } from 'ethers'
import { smock, FakeContract } from '@defi-wonderland/smock'

/* Internal Imports */
import { expect } from '../../setup'

const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero
const TOKEN_ID = 10
const TOKEN_URI = '11111'
const BASE_URI = 'AAAAA'
const DUMMY_L1ERC721_ADDRESS: string =
  '0x2234223412342234223422342234223422342234'

describe('L2StandardERC721', () => {
  let tokenURIAdmin: Signer
  let l2BridgeImpersonator: Signer
  let alice: Signer
  let Fake__L2ERC721Bridge: FakeContract
  let L2StandardERC721: Contract
  let tokenURIAdminAddress: string
  let l2BridgeImpersonatorAddress: string
  let aliceAddress: string

  before(async () => {
    ;[tokenURIAdmin, l2BridgeImpersonator, alice] = await ethers.getSigners()
    tokenURIAdminAddress = await tokenURIAdmin.getAddress()
    l2BridgeImpersonatorAddress = await l2BridgeImpersonator.getAddress()
    aliceAddress = await alice.getAddress()

    L2StandardERC721 = await (
      await ethers.getContractFactory('L2StandardERC721')
    ).deploy(
      l2BridgeImpersonatorAddress,
      DUMMY_L1ERC721_ADDRESS,
      'L2ERC721',
      'ERC'
    )

    // Get a new fake L2 bridge
    Fake__L2ERC721Bridge = await smock.fake<Contract>(
      await ethers.getContractFactory('L2ERC721Bridge'),
      // This allows us to use an ethers override {from: Fake__L2ERC721Bridge.address} to mock calls
      { address: await l2BridgeImpersonator.getAddress() }
    )

    // mint an nft to alice
    await L2StandardERC721.connect(l2BridgeImpersonator).mint(
      aliceAddress,
      TOKEN_ID,
      {
        from: Fake__L2ERC721Bridge.address,
      }
    )
  })

  beforeEach(async () => {
    // set tokenURI and baseURI
    await L2StandardERC721.connect(tokenURIAdmin).setTokenURI(
      TOKEN_ID,
      TOKEN_URI
    )
    await L2StandardERC721.connect(tokenURIAdmin).setBaseURI(BASE_URI)
  })

  describe('constructor', () => {
    it('should be able to create a standard ERC721 contract with the correct parameters', async () => {
      expect(await L2StandardERC721.l2Bridge()).to.equal(
        l2BridgeImpersonatorAddress
      )
      expect(await L2StandardERC721.l1Token()).to.equal(DUMMY_L1ERC721_ADDRESS)
      expect(await L2StandardERC721.name()).to.equal('L2ERC721')
      expect(await L2StandardERC721.symbol()).to.equal('ERC')

      // TokenURIAdmin has been given admin privileges
      expect(
        await L2StandardERC721.hasRole(DEFAULT_ADMIN_ROLE, tokenURIAdminAddress)
      )

      // alice has been minted an nft
      expect(await L2StandardERC721.ownerOf(TOKEN_ID)).to.equal(aliceAddress)
    })
  })

  describe('mint and burn', () => {
    it('should not allow anyone but the L2 bridge to mint and burn', async () => {
      await expect(
        L2StandardERC721.connect(alice).mint(aliceAddress, 100)
      ).to.be.revertedWith('Only L2 Bridge can mint and burn')
      await expect(
        L2StandardERC721.connect(alice).burn(aliceAddress, 100)
      ).to.be.revertedWith('Only L2 Bridge can mint and burn')
    })
  })

  describe('supportsInterface', () => {
    it('should return the correct interface support', async () => {
      const supportsERC165 = await L2StandardERC721.supportsInterface(
        0x01ffc9a7
      )
      expect(supportsERC165).to.be.true

      const supportsL2TokenInterface = await L2StandardERC721.supportsInterface(
        0x1d1d8b63
      )
      expect(supportsL2TokenInterface).to.be.true

      const supportsERC721Interface = await L2StandardERC721.supportsInterface(
        0x80ac58cd
      )
      expect(supportsERC721Interface).to.be.true

      const badSupports = await L2StandardERC721.supportsInterface(0xffffffff)
      expect(badSupports).to.be.false
    })
  })

  describe('setTokenURI', () => {
    const newTokenURI = '22222'

    it('should change the tokenURI of tokenId', async () => {
      // check the initial value of tokenURI
      expect(await L2StandardERC721.tokenURI(TOKEN_ID)).to.equal(
        BASE_URI.concat(TOKEN_URI)
      )

      // change the tokenURI
      await L2StandardERC721.connect(tokenURIAdmin).setTokenURI(
        TOKEN_ID,
        newTokenURI
      )

      expect(await L2StandardERC721.tokenURI(TOKEN_ID)).to.equal(
        BASE_URI.concat(newTokenURI)
      )
    })

    it('should revert on calls made by account other than TokenURIAdmin', async () => {
      await expect(
        L2StandardERC721.connect(alice).setTokenURI(TOKEN_ID, newTokenURI)
      ).to.be.revertedWith(
        `AccessControl: account ${aliceAddress.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      )
    })
  })

  describe('setBaseURI', () => {
    const newBaseURI = 'BBBBB'

    it('should change the baseURI', async () => {
      // check the initial baseURI
      expect(await L2StandardERC721.baseTokenURI()).to.equal(BASE_URI)

      // change the baseURI
      await L2StandardERC721.connect(tokenURIAdmin).setBaseURI(newBaseURI)

      expect(await L2StandardERC721.baseTokenURI()).to.equal(newBaseURI)
    })

    it('should revert on calls made by account other than TokenURIAdmin', async () => {
      await expect(
        L2StandardERC721.connect(alice).setBaseURI(newBaseURI)
      ).to.be.revertedWith(
        `AccessControl: account ${aliceAddress.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      )
    })
  })

  describe('access control', () => {
    it("revokeRole() can revoke token uri admin's privileges", async () => {
      // revokes admin privileges
      await L2StandardERC721.connect(tokenURIAdmin).revokeRole(
        DEFAULT_ADMIN_ROLE,
        tokenURIAdminAddress
      )

      // token uri admin can't change token uri's anymore
      await expect(
        L2StandardERC721.connect(tokenURIAdmin).setBaseURI(BASE_URI)
      ).to.be.revertedWith(
        `AccessControl: account ${tokenURIAdminAddress.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      )
    })
  })
})
