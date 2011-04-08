class AddClubToUser < ActiveRecord::Migration
  def self.up
    add_column :users, :club, :string
    User.all.each do |u|
      u.update_attribute(:club, "COMOPOLO")
    end
  end

  def self.down
    remove_column :users, :club
  end
end
