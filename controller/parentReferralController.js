import { doc, updateDoc, getDoc } from "firebase/firestore";
import {db} from "../config/config.js";


export const updateParentReferralArray = async (req, res) => {

  console.log("Entered Server"); 

    const childrenId = req.params.id; 

    try {
      console.log("Children ID in try block: ", childrenId);
        const childRef =  await getDoc(doc(db, 'users', childrenId));
        let parentReferralCode;
        if(childRef.exists()) {
          const childData = childRef.data();
          parentReferralCode = childData.parentReferralCode;
          console.log("Parent Referral Code in try block: ", parentReferralCode);

          const parentRef = doc(db, 'users', parentReferralCode);
          const parentRefGet = await getDoc(parentRef);
          if(parentRefGet.exists()) {
            const parentData = parentRefGet.data();
            console.log("Parent Data in try block: ", parentData);
            const referralUsersArray = [...parentData.referralUsers, childrenId];
          
          await updateDoc(parentRef, { 
              referralUsers: referralUsersArray,
           });
           const dummyData = {
            name: "John Doe",
            email: "tata.com",
            nameNew: parentData.name
          };
          return res.status(200).send({
            success: true,
            message: "Demo message",
            dummyData
          });
          }
          
        }else {
           return res.status(404).send({
                success: false,
                message: "Child not found",
              });
        }}
        catch (error) {
          console.error(error);
          return res.status(500).send({
            success: false,
            message: "Error updating referral array",
          });
        }

        // const parentRef = doc(db, 'users', parentReferralCode);
        // if(parentRef.exists()) {
        //   console.log("User found");
        // const parentData = await getDoc(parentRef);
          // const referralUsersArray = [...parentData.referralUsers, childrenId];
        // await updateDoc(parentRef, { 
        //     referralUsers: referralUsersArray,
        //  });

        // return res.status(200).send({
        //     success: true,
        //     message: "Referral array updated successfully",
        //     dummyData
        //   });

        // }else{
    //       return  res.status(405).send({
    //             success: false,
    //             message: "User not found",
    //             dummyData
    //           });
    //     }
    //   } catch (error) {
    //     console.error(error);
    //     return res.status(500).send({
    //       success: false,
    //       message: "Error updating referral array",
    //       dummyData
    //     });
    //   }
    };