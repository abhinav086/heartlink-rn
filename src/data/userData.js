// data/userData.js
export const users = {
  1: {
    username: "Sakshi",
    profilePic: require("../assets/images/users/user11.webp"),
    bio: "Photographer & Traveler",
    posts: [
      require("../assets/images/posts/post10.webp"),
      require("../assets/images/posts/post21.webp"),
      require("../assets/images/posts/post1.webp"),
    ],
    followers: 100,
    following: 50,
  },
  2: {
    username: "Jane Smith",
    profilePic: require("../assets/images/users/user16.webp"),
    bio: "Food Lover & Chef",
    posts: [
      require("../assets/images/posts/post11.webp"),
      require("../assets/images/posts/post13.webp"),
    ],
    followers: 300,
    following: 200,
  },
  // Add more dummy users as needed
};
