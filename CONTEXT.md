# eBike-GPS-App

The application that lets a person who has bought an eBike GPS tracker board register, pair the board to their account, and monitor its state and live location.

## Language

**User**:
A person with a login to the app.
_Avoid_: Account, Customer

**Board**:
The physical GPS tracker device purchased by a User and paired to their app account. Runs the firmware maintained in the `eBike-GPS-Tracker` repo.
_Avoid_: Tracker, Device

**Owner**:
The User who paired a Board — establishing exclusive control over it. Exactly one Owner per Board at a time. Only the Owner can unpair the Board or grant/revoke Member access to it.
_Avoid_: Main user, primary user

**Member**:
A User granted access to a Board they do not own, by that Board's Owner. A Member can monitor the Board's state and location and arm/disarm its alarm, but cannot unpair the Board or manage who else has access to it. There is no separate "Family" or household entity — access is a direct Owner-to-User grant.
_Avoid_: Family member, shared user

**Pairing**:
The act of associating a Board with a User as its Owner. A Board must be unpaired before a new User can pair it as Owner (e.g. resale, handoff).
_Avoid_: Linking, registering
